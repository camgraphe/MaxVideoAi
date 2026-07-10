import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { deriveGenerationAttachmentReferences } from '../frontend/app/api/generate/_lib/attachment-references';
import { buildGenerateValidationPayload } from '../frontend/app/api/generate/_lib/validation-payload';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/validation-payload.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = existsSync(helperPath) ? readFileSync(helperPath, 'utf8') : '';

const baseParams = {
  engineId: 'seedance-2-0',
  mode: 't2v' as const,
  prompt: 'A cinematic mountain shot',
  multiPrompt: null,
  supportsResolution: true,
  effectiveResolution: '1080p',
  supportsAspectRatio: true,
  aspectRatio: '16:9',
  audioEnabled: true,
  isBytePlusV1a: false,
  supportsDuration: true,
  numFrames: null,
  validationDuration: 8,
  maxUploadedBytes: 0,
  resolvedFirstFrameUrl: null,
  lastFrameUrl: null,
  normalizedReferenceImages: [],
  videoUrls: [],
  audioUrls: [],
  resolvedAudioUrl: null,
  sourceInputVideoUrl: null,
  elements: null,
  endImageUrl: null,
  isLumaRay2: false,
  initialImageUrl: null,
  startImageUrl: null,
};

test('generate route delegates validation payload and required input checks', () => {
  assert.ok(existsSync(helperPath), 'validation payload building should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/validation-payload'/);
  assert.doesNotMatch(routeSource, /const validationPayload: Record<string, unknown> = \{\}/);
  assert.doesNotMatch(routeSource, /needsSourceVideoEdit/, 'required input branching belongs in validation-payload.ts');
  assert.doesNotMatch(routeSource, /validateRequest\(engine\.id, mode, validationPayload\)/);

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1585, `/api/generate route should stay below 1585 lines after validation payload extraction, got ${lineCount}`);
});

test('validation payload helper exposes the route contract', () => {
  assert.match(helperSource, /export type GenerateValidationPayloadResult/, 'GenerateValidationPayloadResult should be exported');
  assert.match(helperSource, /export function buildGenerateValidationPayload/, 'validation payload builder should be exported');
});

test('validation payload helper builds base payload and mode flags', () => {
  const result = buildGenerateValidationPayload({
    ...baseParams,
    deps: {
      validateRequestFn: () => ({ ok: true }),
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload, {
    prompt: 'A cinematic mountain shot',
    resolution: '1080p',
    aspect_ratio: '16:9',
    generate_audio: true,
    duration: 8,
  });
  assert.equal(result.needsImage, false);
  assert.equal(result.needsFirstLastFrames, false);
  assert.equal(result.needsSourceVideoEdit, false);
});

test('validation payload helper includes provider seed and safety checker controls', () => {
  const result = buildGenerateValidationPayload({
    ...baseParams,
    engineId: 'happy-horse-1-1',
    seed: 12345,
    safetyChecker: false,
    deps: {
      validateRequestFn: (_engineId, _mode, payload) => {
        assert.equal(payload.seed, 12345);
        assert.equal(payload.enable_safety_checker, false);
        return { ok: true };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.seed, 12345);
  assert.equal(result.payload.enable_safety_checker, false);
});

test('validation payload helper includes loop for provider constraints', () => {
  const result = buildGenerateValidationPayload({
    ...baseParams,
    engineId: 'luma-ray-3-2',
    validationDuration: '10s',
    loop: true,
    deps: {
      validateRequestFn: (_engineId, _mode, payload) => {
        assert.equal(payload.loop, true);
        assert.equal(payload.duration, '10s');
        return { ok: true };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.loop, true);
});

test('validation payload helper accepts BytePlus ref2v with video-only references', () => {
  const result = buildGenerateValidationPayload({
    ...baseParams,
    mode: 'ref2v',
    isBytePlusV1a: true,
    normalizedReferenceImages: [],
    videoUrls: ['https://cdn.maxvideoai.com/ref.mp4'],
    resolvedAudioUrl: 'https://cdn.maxvideoai.com/ref.wav',
    audioUrls: ['https://cdn.maxvideoai.com/ref.wav', 'https://cdn.maxvideoai.com/alt.wav'],
    deps: {
      validateRequestFn: () => ({ ok: true }),
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.payload.video_urls, ['https://cdn.maxvideoai.com/ref.mp4']);
  assert.deepEqual(result.payload.audio_urls, [
    'https://cdn.maxvideoai.com/ref.wav',
    'https://cdn.maxvideoai.com/alt.wav',
  ]);
  assert.equal(result.needsReferenceImages, true);
});

test('validation payload helper rejects missing Luma image-to-video image', () => {
  const result = buildGenerateValidationPayload({
    ...baseParams,
    engineId: 'luma-ray-2',
    mode: 'i2v',
    isLumaRay2: true,
    deps: {
      validateRequestFn: () => ({ ok: true }),
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.metric, {
    errorCode: 'IMAGE_URL_REQUIRED',
    meta: { engineId: 'luma-ray-2', mode: 'i2v' },
  });
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { ok: false, error: 'Image URL is required for Luma Ray 2 image-to-video' });
});

test('validation payload helper rejects missing first and last frames', () => {
  const result = buildGenerateValidationPayload({
    ...baseParams,
    mode: 'fl2v',
    resolvedFirstFrameUrl: 'https://cdn.maxvideoai.com/first.jpg',
    lastFrameUrl: null,
    deps: {
      validateRequestFn: () => ({ ok: true }),
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.metric?.errorCode, 'IMAGE_URL_REQUIRED');
  assert.deepEqual(result.body, { ok: false, error: 'Both first and last frames are required for this engine mode' });
});

test('Studio first-last end image becomes an API last-frame payload', () => {
  const references = deriveGenerationAttachmentReferences({
    engineId: 'veo-3-1',
    mode: 'fl2v',
    imageUrl: 'https://cdn.maxvideoai.com/studio-first-frame.png',
    endImageUrl: 'https://cdn.maxvideoai.com/studio-last-frame.png',
    attachments: [],
  });
  const result = buildGenerateValidationPayload({
    ...baseParams,
    engineId: 'veo-3-1',
    mode: 'fl2v',
    resolvedFirstFrameUrl: references.resolvedFirstFrameUrl,
    lastFrameUrl: references.lastFrameUrl,
    deps: {
      validateRequestFn: () => ({ ok: true }),
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload.first_frame_url, 'https://cdn.maxvideoai.com/studio-first-frame.png');
  assert.equal(result.payload.last_frame_url, 'https://cdn.maxvideoai.com/studio-last-frame.png');
});

test('validation payload helper converts engine constraint errors to route responses', () => {
  const result = buildGenerateValidationPayload({
    ...baseParams,
    deps: {
      validateRequestFn: () => ({
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          message: 'Unsupported duration',
          field: 'duration',
          allowed: [5, 10],
          value: 8,
        },
      }),
    },
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.metric, {
    errorCode: 'ENGINE_CONSTRAINT',
    meta: {
      field: 'duration',
      allowed: [5, 10],
      value: 8,
    },
  });
  assert.deepEqual(result.body, {
    ok: false,
    error: 'ENGINE_CONSTRAINT',
    message: 'Unsupported duration',
    field: 'duration',
    allowed: [5, 10],
    value: 8,
  });
});

test('validation payload helper includes image-to-video end frame for provider constraints', () => {
  let capturedPayload: Record<string, unknown> | null = null;
  const result = buildGenerateValidationPayload({
    ...baseParams,
    engineId: 'minimax-hailuo-02-text',
    mode: 'i2v',
    effectiveResolution: '512P',
    audioEnabled: false,
    initialImageUrl: 'https://cdn.maxvideoai.com/start.png',
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
    deps: {
      validateRequestFn: (_engineId, _mode, payload) => {
        capturedPayload = payload;
        return { ok: true };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(capturedPayload?.image_url, 'https://cdn.maxvideoai.com/start.png');
  assert.equal(capturedPayload?.end_image_url, 'https://cdn.maxvideoai.com/end.png');
});

test('validation payload helper rejects Kling 3.0 Omni reference end frame without start frame', () => {
  for (const engineId of ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k']) {
    const result = buildGenerateValidationPayload({
      ...baseParams,
      engineId,
      mode: 'ref2v',
      normalizedReferenceImages: ['https://cdn.maxvideoai.com/reference.png'],
      endImageUrl: 'https://cdn.maxvideoai.com/end.png',
      deps: {
        validateRequestFn: () => ({ ok: true }),
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.deepEqual(result.metric, {
      errorCode: 'START_IMAGE_URL_REQUIRED',
      meta: { engineId, mode: 'ref2v' },
    });
    assert.deepEqual(result.body, {
      ok: false,
      error: 'End frame requires a start frame for Kling 3.0 Omni reference-to-video.',
    });
  }
});
