import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGenerateValidationPayload } from '../frontend/app/api/generate/_lib/validation-payload';
import { validateProviderSpecificConstraints } from '../frontend/app/api/generate/_lib/validate-provider-constraints';
import { MINIMAX_H3_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/minimax-h3';
import type { Mode } from '../frontend/types/engines';

const inputSchema = MINIMAX_H3_FAL_ENGINE_REGISTRY[0]?.engine.inputSchema;
assert.ok(inputSchema, 'MiniMax H3 test schema should exist');

function providerPayload(mode: Mode, overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    prompt: 'An original character crosses the station.',
    duration: 10,
    resolution: '2K',
    ...(mode === 't2v' || mode === 'ref2v' ? { aspect_ratio: '16:9' } : {}),
    ...(mode === 'i2v' ? { image_url: 'https://media.maxvideoai.com/start.jpg' } : {}),
    ...(mode === 'ref2v' ? { reference_image_urls: ['https://media.maxvideoai.com/ref.jpg'] } : {}),
  };
  return { ...base, ...overrides };
}

function validate(mode: Mode, overrides: Record<string, unknown> = {}) {
  return validateProviderSpecificConstraints({
    engineId: 'minimax-h3',
    normalizedMode: mode,
    payload: providerPayload(mode, overrides),
  });
}

function assertFails(mode: Mode, overrides: Record<string, unknown>, field: string) {
  const result = validate(mode, overrides);
  assert.equal(result.ok, false, `${mode}.${field} should fail`);
  if (!result.ok) assert.equal(result.error.field, field);
}

test('MiniMax H3 validates integer duration, resolution, aspect ratio, and prompt boundaries', () => {
  for (const duration of [5, 15]) assert.equal(validate('t2v', { duration }).ok, true);
  for (const duration of [4, 16, 5.5]) assertFails('t2v', { duration }, 'duration');

  for (const resolution of ['768P', '2K', '4K']) assert.equal(validate('t2v', { resolution }).ok, true);
  assertFails('t2v', { resolution: '1080p' }, 'resolution');

  for (const aspect_ratio of ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16', 'auto']) {
    assert.equal(validate('t2v', { aspect_ratio }).ok, true);
    assert.equal(validate('ref2v', { aspect_ratio }).ok, true);
  }
  assertFails('t2v', { aspect_ratio: '2:1' }, 'aspect_ratio');
  assertFails('i2v', { aspect_ratio: '16:9' }, 'aspect_ratio');

  assert.equal(validate('t2v', { prompt: 'x' }).ok, true);
  assert.equal(validate('t2v', { prompt: 'x'.repeat(7000) }).ok, true);
  assertFails('t2v', { prompt: 'x'.repeat(7001) }, 'prompt');
  assertFails('t2v', { prompt: '   ' }, 'prompt');
});

test('MiniMax H3 validates image and multimodal reference shapes before billing', () => {
  assert.equal(validate('i2v').ok, true);
  assertFails('i2v', { image_url: undefined }, 'image_url');
  assertFails('i2v', { image_url: ['a.jpg', 'b.jpg'] }, 'image_url');
  assert.equal(validate('i2v', { end_image_url: 'https://media.maxvideoai.com/end.jpg' }).ok, true);

  assert.equal(validate('ref2v', { reference_video_urls: ['motion.mp4'], reference_image_urls: [] }).ok, true);
  assert.equal(validate('ref2v', { reference_image_urls: ['look.jpg'] }).ok, true);
  assert.equal(validate('ref2v', { reference_image_urls: ['look.jpg'], reference_audio_urls: ['voice.wav'] }).ok, true);
  assert.equal(validate('ref2v', { reference_image_urls: [], reference_video_urls: ['motion.mp4'], reference_audio_urls: ['voice.wav'] }).ok, true);
  assertFails('ref2v', { reference_image_urls: [], reference_video_urls: [], reference_audio_urls: ['voice.wav'] }, 'reference_audio_urls');

  assert.equal(validate('ref2v', { reference_image_urls: Array.from({ length: 9 }, (_, index) => `image-${index}.jpg`) }).ok, true);
  assertFails('ref2v', { reference_image_urls: Array.from({ length: 10 }, (_, index) => `image-${index}.jpg`) }, 'reference_image_urls');
  assert.equal(validate('ref2v', { reference_video_urls: ['a.mp4', 'b.mp4', 'c.mp4'] }).ok, true);
  assertFails('ref2v', { reference_video_urls: ['a.mp4', 'b.mp4', 'c.mp4', 'd.mp4'] }, 'reference_video_urls');
  assert.equal(validate('ref2v', { reference_audio_urls: ['a.wav', 'b.wav', 'c.wav'] }).ok, true);
  assertFails('ref2v', { reference_audio_urls: ['a.wav', 'b.wav', 'c.wav', 'd.wav'] }, 'reference_audio_urls');

  const twelve = Array.from({ length: 12 }, (_, index) => `ref-${index}`);
  assert.equal(validate('ref2v', {
    reference_image_urls: twelve.slice(0, 9),
    reference_video_urls: twelve.slice(9),
  }).ok, true);
  assertFails('ref2v', {
    reference_image_urls: twelve.slice(0, 9),
    reference_video_urls: twelve.slice(9),
    reference_audio_urls: ['ref-12'],
  }, 'referenceBudget');
  assert.equal(validate('ref2v', {
    reference_image_urls: ['same.jpg', 'same.jpg'],
    reference_video_urls: ['same.jpg'],
  }).ok, true);
});

test('MiniMax H3 rejects unsupported audio controls and generic reference field aliases', () => {
  assertFails('t2v', { generate_audio: true }, 'generate_audio');
  assertFails('t2v', { audio: true }, 'audio');
  assertFails('ref2v', { image_urls: ['wrong.jpg'] }, 'image_urls');
  assertFails('ref2v', { video_urls: ['wrong.mp4'] }, 'video_urls');
  assertFails('ref2v', { audio_urls: ['wrong.wav'] }, 'audio_urls');
});

function validationParams(overrides: Partial<Parameters<typeof buildGenerateValidationPayload>[0]> = {}) {
  return {
    engineId: 'minimax-h3',
    mode: 't2v' as Mode,
    prompt: 'An original character crosses the station.',
    multiPrompt: null,
    supportsResolution: true,
    effectiveResolution: '2K',
    supportsAspectRatio: true,
    aspectRatio: '16:9',
    audioEnabled: true,
    isBytePlusV1a: false,
    supportsDuration: true,
    numFrames: null,
    validationDuration: 10,
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
    startImageUrl: null,
    isLumaRay2: false,
    initialImageUrl: null,
    inputSchema,
    referenceValuesByField: {},
    referenceMediaItems: [],
    referenceProvenanceIssues: [],
    deps: {
      validateRequestFn: (_engineId: string, mode: Mode | undefined, payload: Record<string, unknown>) =>
        validateProviderSpecificConstraints({ engineId: 'minimax-h3', normalizedMode: mode ?? 't2v', payload }),
    },
    ...overrides,
  };
}

test('generate validation payload uses exact H3 reference fields and accepts video-only input', () => {
  const result = buildGenerateValidationPayload(validationParams({
    mode: 'ref2v',
    normalizedReferenceImages: [],
    videoUrls: ['https://media.maxvideoai.com/motion.mp4'],
    audioUrls: ['https://media.maxvideoai.com/station.wav'],
    resolvedAudioUrl: 'https://media.maxvideoai.com/station.wav',
  }));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.payload, {
    prompt: 'An original character crosses the station.',
    resolution: '2K',
    aspect_ratio: '16:9',
    duration: 10,
    reference_video_urls: ['https://media.maxvideoai.com/motion.mp4'],
    reference_audio_urls: ['https://media.maxvideoai.com/station.wav'],
  });
});

test('generate validation payload never adds an H3 audio toggle', () => {
  const result = buildGenerateValidationPayload(validationParams());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal('generate_audio' in result.payload, false);
  assert.equal('audio' in result.payload, false);
});
