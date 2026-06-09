import assert from 'node:assert/strict';
import test from 'node:test';

import { ImageGenerationExecutionError } from '../frontend/src/server/images/image-generation-error';
import { LumaAgentsImageError } from '../frontend/src/server/images/luma-agents-error';
import { executeLumaAgentsImageGenerationWithFalFallback } from '../frontend/src/server/images/luma-agents-execution';
import type { NormalizedLumaAgentsImageGeneration } from '../frontend/src/server/images/luma-agents-response';
import type { GeneratedImage } from '../frontend/types/image-generation';

function baseParams() {
  return {
    falModelId: 'luma/agent/uni-1/v1/text-to-image',
    effectivePrompt: 'A clean product render',
    numImages: 1,
    mode: 't2i' as const,
    combinedImageUrls: ['https://media.maxvideoai.com/ref.png'],
    falAspectRatio: '1:1',
    providerImageSize: null,
    resolutionEngineParam: null,
    normalizedSeed: null,
    outputFormat: 'png',
    quality: null,
    maskUrl: null,
    enableWebSearch: true,
    thinkingLevel: null,
    limitGenerations: false,
    engine: {
      id: 'luma-uni-1',
      label: 'Luma Uni-1',
    },
    engineEntry: {
      id: 'luma-uni-1',
      marketingName: 'Luma Uni-1',
    },
    jobId: 'img_test',
    userId: 'user_test',
    pollIntervalMs: 1,
    syncTimeoutMs: 100,
    sleep: async () => {},
    signReferenceUrls: async (urls: string[]) => urls,
  };
}

test('Luma image direct success copies expiring provider image URLs before returning', async () => {
  const copiedInputs: GeneratedImage[][] = [];
  const client = {
    async createGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
      return {
        providerJobId: 'gen_luma_123',
        status: 'queued',
        rawStatus: 'queued',
        images: [],
        message: null,
        raw: { id: 'gen_luma_123' },
      };
    },
    async getGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
      return {
        providerJobId: 'gen_luma_123',
        status: 'completed',
        rawStatus: 'completed',
        images: [
          {
            url: 'https://assets.luma.ai/output.png?expires=soon',
            width: 1024,
            height: 1024,
            mimeType: 'image/png',
          },
        ],
        message: null,
        raw: { id: 'gen_luma_123' },
      };
    },
  };

  const { result, providerJobId } = await executeLumaAgentsImageGenerationWithFalFallback({
    ...baseParams(),
    client,
    copyGeneratedImagesToStorage: async ({ images }) => {
      copiedInputs.push(images);
      return images.map((image) => ({
        ...image,
        url: 'https://media.maxvideoai.com/renders/images/user_test/img_test-1.png',
      }));
    },
    runFalImageGeneration: async () => {
      throw new Error('Fal should not run for direct success');
    },
  });

  assert.equal(providerJobId, 'gen_luma_123');
  assert.equal(copiedInputs.length, 1);
  assert.equal(copiedInputs[0]?.[0]?.url, 'https://assets.luma.ai/output.png?expires=soon');
  const images = (result.data as { images?: Array<{ url?: string }> }).images ?? [];
  assert.equal(images[0]?.url, 'https://media.maxvideoai.com/renders/images/user_test/img_test-1.png');
  assert.equal(result.requestId, 'gen_luma_123');
});

test('Luma image submit rate limit falls back to fal before provider acceptance', async () => {
  let falCalls = 0;
  const { result, providerJobId, providerMode } = await executeLumaAgentsImageGenerationWithFalFallback({
    ...baseParams(),
    client: {
      async createGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
        throw new LumaAgentsImageError('Rate limit exceeded', {
          status: 429,
          body: { detail: 'Rate limit exceeded' },
        });
      },
      async getGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
        throw new Error('Poll should not run after failed submit');
      },
    },
    runFalImageGeneration: async () => {
      falCalls += 1;
      return {
        providerJobId: 'fal_req_123',
        result: {
          requestId: 'fal_req_123',
          data: {
            images: [{ url: 'https://fal.media/files/output.png' }],
          },
        },
      };
    },
    copyGeneratedImagesToStorage: async () => {
      throw new Error('Direct copy should not run for fal fallback');
    },
  });

  assert.equal(falCalls, 1);
  assert.equal(providerJobId, 'fal_req_123');
  assert.equal(result.requestId, 'fal_req_123');
  assert.equal(providerMode, 'FAL');
});

test('Luma image accepted job failure does not fallback to fal', async () => {
  let falCalls = 0;

  await assert.rejects(
    () =>
      executeLumaAgentsImageGenerationWithFalFallback({
        ...baseParams(),
        client: {
          async createGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
            return {
              providerJobId: 'gen_luma_failed',
              status: 'running',
              rawStatus: 'dreaming',
              images: [],
              message: null,
              raw: { id: 'gen_luma_failed' },
            };
          },
          async getGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
            return {
              providerJobId: 'gen_luma_failed',
              status: 'failed',
              rawStatus: 'failed',
              images: [],
              message: 'Safety policy blocked this generation',
              raw: { id: 'gen_luma_failed', failure_reason: 'Safety policy blocked this generation' },
            };
          },
        },
        runFalImageGeneration: async () => {
          falCalls += 1;
          throw new Error('Fal should not run after Luma acceptance');
        },
      }),
    (error) =>
      error instanceof ImageGenerationExecutionError &&
      error.code === 'luma_agents_image_failed' &&
      /Safety policy blocked/.test(error.message)
  );

  assert.equal(falCalls, 0);
});

test('Luma image invalid direct payload does not fallback to fal', async () => {
  let falCalls = 0;

  await assert.rejects(
    () =>
      executeLumaAgentsImageGenerationWithFalFallback({
        ...baseParams(),
        outputFormat: 'webp',
        client: {
          async createGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
            throw new Error('Submit should not run for invalid payload');
          },
          async getGeneration(): Promise<NormalizedLumaAgentsImageGeneration> {
            throw new Error('Poll should not run for invalid payload');
          },
        },
        runFalImageGeneration: async () => {
          falCalls += 1;
          throw new Error('Fal should not run for invalid payload');
        },
      }),
    (error) =>
      error instanceof LumaAgentsImageError &&
      error.errorClass === 'invalid_request' &&
      error.code === 'LUMA_AGENTS_IMAGE_OUTPUT_FORMAT_UNSUPPORTED'
  );

  assert.equal(falCalls, 0);
});
