import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../frontend/node_modules/typescript/lib/typescript.js';

import * as imageRenders from '../frontend/lib/image-renders.ts';
import { GoogleVertexImageClient } from '../frontend/src/server/images/google-vertex-image-client.ts';
import * as vertexError from '../frontend/src/server/images/google-vertex-image-error.ts';
import * as vertexPayload from '../frontend/src/server/images/google-vertex-image-payload.ts';
import * as vertexResponse from '../frontend/src/server/images/google-vertex-image-response.ts';
import * as executionError from '../frontend/src/server/images/image-generation-error.ts';

type Executor = typeof import('../frontend/src/server/images/google-vertex-image-execution.ts').executeGoogleVertexImageGeneration;
type Completion = typeof import('../frontend/src/server/images/image-generation-completion.ts').persistCompletedImageGeneration;

// Keep the real executor, payload, HTTP client, response parser and completion log.
// Only network/authentication, storage and database effects use synthetic adapters.
function loadModule<T>(path: string, dependencies: Record<string, unknown>): T {
  const source = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(source, {
    exports, Buffer, AbortController, setTimeout, clearTimeout, console,
    require(id: string) {
      assert.ok(Object.hasOwn(dependencies, id), `Unexpected dependency: ${id}`);
      return dependencies[id];
    },
  });
  return exports as T;
}

for (const { engineId, modelId, thinkingLevel, wireLevel } of [
  { engineId: 'nano-banana-2', modelId: 'gemini-3.1-flash-image', thinkingLevel: 'minimal', wireLevel: 'MINIMAL' },
  { engineId: 'nano-banana-2', modelId: 'gemini-3.1-flash-image', thinkingLevel: 'high', wireLevel: 'HIGH' },
  { engineId: 'nano-banana-2', modelId: 'gemini-3.1-flash-image', thinkingLevel: null, wireLevel: null },
  ...['minimal', 'high'].flatMap((thinkingLevel) => [
    { engineId: 'nano-banana-pro', modelId: 'gemini-3-pro-image', thinkingLevel, wireLevel: null },
    { engineId: 'nano-banana-lite', modelId: 'gemini-3.1-flash-lite-image', thinkingLevel, wireLevel: null },
  ]),
] as const) {
  test(`${engineId} preserves ${thinkingLevel ?? 'unset'} thinking through Vertex transport and completion persistence`, async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
    const { persistCompletedImageGeneration } = loadModule<{ persistCompletedImageGeneration: Completion }>(
      'frontend/src/server/images/image-generation-completion.ts', {
        '@/lib/db': { query: async (sql: string, params?: readonly unknown[]) => { queries.push({ sql, params }); return []; } },
        '@/lib/image-renders': imageRenders,
        '@/server/media-library': { upsertLegacyJobOutputs: async () => undefined },
        './image-initial-job': { PLACEHOLDER_THUMB: '/placeholder.png' },
      },
    );
    class SyntheticTransportClient extends GoogleVertexImageClient {
      constructor() {
        super({
          projectId: 'synthetic-project', location: 'global', apiBaseUrl: 'https://vertex.invalid',
          serviceAccount: { client_email: 'synthetic@example.invalid', private_key: 'unused' },
          getAccessTokenFn: async () => 'synthetic-token',
          fetchFn: async (url, init) => {
            requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
            return new Response(JSON.stringify({
              responseId: 'synthetic-response',
              candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'Zml4dHVyZQ==' } }] } }],
            }), { status: 200 });
          },
        });
      }
    }
    const { executeGoogleVertexImageGeneration } = loadModule<{ executeGoogleVertexImageGeneration: Executor }>(
      'frontend/src/server/images/google-vertex-image-execution.ts', {
        '@/lib/media': { normalizeMediaUrl: (url: string) => url },
        '@/server/storage': {
          isStorageConfigured: () => true,
          uploadImageToStorage: async () => ({ url: 'https://storage.invalid/output.png', width: 1024, height: 1024, mime: 'image/png' }),
        },
        '@/server/image-thumbnails': { createImageThumbnailBatch: async () => ['https://storage.invalid/thumb.jpg'] },
        '@/server/video-providers/google-vertex-gcs': {},
        './google-vertex-image-client': { GoogleVertexImageClient: SyntheticTransportClient, isGoogleVertexImageConfigured: () => true },
        './google-vertex-image-error': vertexError,
        './google-vertex-image-payload': vertexPayload,
        './google-vertex-image-response': vertexResponse,
        './image-generation-completion': { persistCompletedImageGeneration },
        './image-generation-failure': { persistFailedImageGeneration: async () => assert.fail('Unexpected failed generation') },
        './image-generation-error': executionError,
      },
    );
    const numImages = engineId === 'nano-banana-2' && thinkingLevel === 'minimal' ? 2 : 1;
    const resolution = engineId === 'nano-banana-lite' ? '1K' : '2K';
    const result = await executeGoogleVertexImageGeneration({
      billingProductKey: null, characterReferenceCount: 0, combinedImageUrls: [], costBreakdownJson: null,
      effectivePrompt: 'Synthetic product image', enableWebSearch: false,
      engine: { id: engineId, label: engineId, providerMeta: { provider: 'google_vertex_image', modelSlug: modelId } } as Parameters<Executor>[0]['engine'],
      engineEntry: { id: engineId, marketingName: engineId },
      indexable: false, jobId: 'synthetic-image-job', jobSurface: 'image', limitGenerations: false,
      maskUrl: null, mode: 't2i', normalizedSeed: null, numImages, outputFormat: 'png',
      pendingReceipt: {} as Parameters<Executor>[0]['pendingReceipt'], priceOnlyReceipts: true,
      pricing: { totalCents: 1, currency: 'USD' } as Parameters<Executor>[0]['pricing'],
      pricingSnapshotJson: '{}', quality: null, refundDescription: 'Synthetic refund',
      resolvedAspectRatio: '1:1', resolution, thinkingLevel,
      userId: 'synthetic-user', vendorAccountId: null, visibility: 'private',
    });
    assert.equal(result.ok, true);
    assert.equal(result.engineId, engineId);
    assert.equal(requests.length, numImages);
    for (const request of requests) {
      assert.equal(request.url, `https://vertex.invalid/v1/projects/synthetic-project/locations/global/publishers/google/models/${modelId}:generateContent`);
      assert.deepEqual(request.body.generationConfig, {
        responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: resolution },
        ...(wireLevel ? { thinkingConfig: { thinkingLevel: wireLevel } } : {}),
      });
    }
    assert.equal(queries.length, 2);
    const log = queries.find(({ sql }) => sql.includes('INSERT INTO fal_queue_log'));
    assert.ok(log);
    assert.equal(log.params?.[1], 'google_vertex_image_direct');
    const recorded = JSON.parse(String(log.params?.[5]));
    if (thinkingLevel) assert.equal(recorded.request.thinking_level, thinkingLevel);
    else assert.equal(Object.hasOwn(recorded.request, 'thinking_level'), false);
  });
}
