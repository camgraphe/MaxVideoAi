import assert from 'node:assert/strict';

import {
  BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  applyBytePlusSeedanceRuntimeOptions,
  buildBytePlusSeedancePayload,
  buildBytePlusSeedanceFastPayload,
  getBytePlusUserSafeErrorMessage,
  normalizeBytePlusTask,
  scrubBytePlusError,
} from '../../src/server/video-providers/byteplus-modelark';
import { getBytePlusAccounting, getBytePlusUnitPriceUsdPer1kTokens } from '../../server/byteplus-poll';
import type { EngineCaps } from '../../types/engines';

const payload = buildBytePlusSeedanceFastPayload({
  modelId: 'dreamina-seedance-2-0-fast-260128',
  prompt: 'A concise product video prompt',
  durationSec: 5,
  mode: 't2v',
});

assert.deepEqual(payload, {
  model: 'dreamina-seedance-2-0-fast-260128',
  content: [{ type: 'text', text: 'A concise product video prompt' }],
  resolution: '720p',
  ratio: '16:9',
  duration: 5,
  generate_audio: false,
  watermark: false,
});

const i2vPayload = buildBytePlusSeedanceFastPayload({
  modelId: 'dreamina-seedance-2-0-fast-260128',
  prompt: 'Animate the provided product photo.',
  durationSec: 5,
  mode: 'i2v',
  imageUrl: 'https://assets.example.com/start.png',
  generateAudio: true,
});

assert.deepEqual(i2vPayload.content, [
  { type: 'text', text: 'Use Image 1 as the opening frame. Animate the provided product photo.' },
  {
    type: 'image_url',
    image_url: { url: 'https://assets.example.com/start.png' },
    role: 'reference_image',
  },
]);
assert.equal(i2vPayload.generate_audio, true);

assert.throws(
  () =>
    buildBytePlusSeedanceFastPayload({
      modelId: 'dreamina-seedance-2-0-fast-260128',
      prompt: 'Missing image',
      durationSec: 5,
      mode: 'i2v',
    }),
  /image url/i
);

const firstLastPayload = buildBytePlusSeedanceFastPayload({
  modelId: 'dreamina-seedance-2-0-fast-260128',
  prompt: 'Create a clean product transition.',
  durationSec: 5,
  mode: 'i2v',
  imageUrl: 'https://assets.example.com/start.png',
  endImageUrl: 'https://assets.example.com/end.png',
});

assert.deepEqual(firstLastPayload.content, [
  {
    type: 'text',
    text: 'Use Image 1 as the opening frame and Image 2 as the final frame. Create a clean product transition.',
  },
  {
    type: 'image_url',
    image_url: { url: 'https://assets.example.com/start.png' },
    role: 'reference_image',
  },
  {
    type: 'image_url',
    image_url: { url: 'https://assets.example.com/end.png' },
    role: 'reference_image',
  },
]);

const standardSeedancePayload = buildBytePlusSeedancePayload({
  modelId: BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  prompt: 'Create a premium cinematic product transition.',
  durationSec: 5,
  mode: 'i2v',
  imageUrl: 'https://assets.example.com/start.png',
  endImageUrl: 'https://assets.example.com/end.png',
  generateAudio: true,
});

assert.equal(standardSeedancePayload.model, 'dreamina-seedance-2-0-260128');
assert.equal(standardSeedancePayload.resolution, '720p');
assert.equal(standardSeedancePayload.generate_audio, true);
assert.deepEqual(standardSeedancePayload.content, [
  {
    type: 'text',
    text: 'Use Image 1 as the opening frame and Image 2 as the final frame. Create a premium cinematic product transition.',
  },
  {
    type: 'image_url',
    image_url: { url: 'https://assets.example.com/start.png' },
    role: 'reference_image',
  },
  {
    type: 'image_url',
    image_url: { url: 'https://assets.example.com/end.png' },
    role: 'reference_image',
  },
]);

const standardSeedance1080pRefPayload = buildBytePlusSeedancePayload({
  modelId: BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  prompt: 'Use these references to create a cinematic brand video.',
  durationSec: 8,
  mode: 'ref2v',
  resolution: '1080p',
  ratio: '9:16',
  referenceImageUrls: ['https://assets.example.com/ref.png'],
  referenceVideoUrls: ['https://assets.example.com/ref.mp4'],
  referenceAudioUrls: ['https://assets.example.com/ref.mp3'],
  generateAudio: true,
  allowedResolutions: ['480p', '720p', '1080p'],
});

assert.equal(standardSeedance1080pRefPayload.resolution, '1080p');
assert.equal(standardSeedance1080pRefPayload.ratio, '9:16');
assert.deepEqual(standardSeedance1080pRefPayload.content, [
  {
    type: 'text',
    text: 'Use these references to create a cinematic brand video.',
  },
  {
    type: 'image_url',
    image_url: { url: 'https://assets.example.com/ref.png' },
    role: 'reference_image',
  },
  {
    type: 'video_url',
    video_url: { url: 'https://assets.example.com/ref.mp4' },
    role: 'reference_video',
  },
  {
    type: 'audio_url',
    audio_url: { url: 'https://assets.example.com/ref.mp3' },
    role: 'reference_audio',
  },
]);

assert.throws(
  () =>
    buildBytePlusSeedanceFastPayload({
      modelId: 'dreamina-seedance-2-0-fast-260128',
      prompt: 'Fast should not accept 1080p.',
      durationSec: 5,
      resolution: '1080p',
      allowedResolutions: ['480p', '720p'],
    }),
  /resolution/i
);

const baseSeedanceEngine = {
  id: 'seedance-2-0',
  label: 'Seedance 2.0',
  provider: 'ByteDance',
  status: 'live',
  latencyTier: 'standard',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 15,
  resolutions: ['480p', '720p'],
  aspectRatios: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {},
  inputSchema: {
    required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
    optional: [
      { id: 'resolution', type: 'enum', label: 'Resolution', values: ['480p', '720p'], default: '720p' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', values: ['auto', '16:9'], default: 'auto' },
      { id: 'image_urls', type: 'image', label: 'Reference images', modes: ['ref2v'], maxCount: 9 },
      { id: 'video_urls', type: 'video', label: 'Reference videos', modes: ['ref2v'], maxCount: 3 },
      { id: 'audio_urls', type: 'audio', label: 'Reference audio', modes: ['ref2v'], maxCount: 3 },
    ],
  },
  updatedAt: '2026-05-02T00:00:00Z',
  ttlSec: 600,
  availability: 'available',
  modeCaps: {
    t2v: { modes: ['t2v'], resolution: ['480p', '720p'], aspectRatio: ['auto', '16:9'] },
    i2v: { modes: ['i2v'], resolution: ['480p', '720p'], aspectRatio: ['auto', '16:9'] },
    ref2v: { modes: ['ref2v'], resolution: ['480p', '720p'], aspectRatio: ['auto', '16:9'] },
  },
} satisfies EngineCaps;

const bytePlusStandardEngine = applyBytePlusSeedanceRuntimeOptions(baseSeedanceEngine, {
  provider: 'byteplus_modelark',
  allowedModes: ['t2v', 'i2v', 'ref2v'],
});

assert.deepEqual(bytePlusStandardEngine.modes, ['t2v', 'i2v', 'ref2v']);
assert.deepEqual(bytePlusStandardEngine.resolutions, ['480p', '720p', '1080p']);
assert.deepEqual(bytePlusStandardEngine.aspectRatios, ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
assert.deepEqual(bytePlusStandardEngine.modeCaps?.ref2v?.resolution, ['480p', '720p', '1080p']);
assert.deepEqual(
  bytePlusStandardEngine.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values,
  ['480p', '720p', '1080p']
);
assert.equal(
  bytePlusStandardEngine.inputSchema?.optional?.find((field) => field.id === 'aspect_ratio')?.default,
  '16:9'
);

assert.equal(getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0'), 0.007);
assert.equal(getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0-fast'), 0.0056);

assert.throws(
  () =>
    buildBytePlusSeedanceFastPayload({
      modelId: 'dreamina-seedance-2-0-fast-260128',
      prompt: 'Too short',
      durationSec: 4,
    }),
  /duration/i
);

assert.deepEqual(
  normalizeBytePlusTask({
    id: 'task_123',
    status: 'succeeded',
    content: {
      video_url: 'https://example.com/video.mp4',
      usage: { total_tokens: 108000 },
    },
  }),
  {
    providerJobId: 'task_123',
    status: 'completed',
    rawStatus: 'succeeded',
    videoUrl: 'https://example.com/video.mp4',
    message: null,
    usage: { totalTokens: 108000, completionTokens: null },
    raw: {
      id: 'task_123',
      status: 'succeeded',
      content: {
        video_url: 'https://example.com/video.mp4',
        usage: { total_tokens: 108000 },
      },
    },
  }
);

assert.equal(
  normalizeBytePlusTask({
    id: 'task_queued',
    status: 'queued',
  }).status,
  'queued'
);

assert.equal(
  normalizeBytePlusTask({
    id: 'task_failed',
    status: 'expired',
    error: { code: 'QuotaExceeded', message: 'resource pack exhausted' },
  }).status,
  'failed'
);

assert.equal(
  scrubBytePlusError({
    message: 'Request failed with Authorization: Bearer ark-real-secret and url https://signed.example.com/a.mp4?X-Amz-Signature=secret',
  }).includes('ark-real-secret'),
  false
);

assert.equal(
  getBytePlusUserSafeErrorMessage('The request failed because the input image may contain real person. Request id: abc'),
  'BytePlus rejected one of the input images. Try an image without identifiable people or private content.'
);

assert.deepEqual(
  getBytePlusAccounting({
    has_audio: true,
    settings_snapshot: {
      inputMode: 'i2v',
      refs: {
        imageUrl: 'https://assets.example.com/start.png',
      },
    },
  }),
  {
    mode: 'i2v',
    inputType: 'image_input',
    hasStartImage: true,
    hasEndImage: false,
    hasReferenceImages: false,
    hasReferenceVideos: false,
    hasReferenceAudio: false,
    generateAudio: true,
    byteplusBillingInputType: 'no_video_input',
  }
);

assert.deepEqual(
  getBytePlusAccounting({
    has_audio: false,
    settings_snapshot: {
      inputMode: 'i2v',
      refs: {
        imageUrl: 'https://assets.example.com/start.png',
        endImageUrl: 'https://assets.example.com/end.png',
      },
    },
  }),
  {
    mode: 'i2v',
    inputType: 'first_last_frame',
    hasStartImage: true,
    hasEndImage: true,
    hasReferenceImages: false,
    hasReferenceVideos: false,
    hasReferenceAudio: false,
    generateAudio: false,
    byteplusBillingInputType: 'no_video_input',
  }
);

assert.deepEqual(
  getBytePlusAccounting({
    has_audio: true,
    settings_snapshot: {
      inputMode: 'ref2v',
      refs: {
        referenceImages: ['https://assets.example.com/ref.png'],
        videoUrls: ['https://assets.example.com/ref.mp4'],
        audioUrl: 'https://assets.example.com/ref.mp3',
      },
    },
  }),
  {
    mode: 'ref2v',
    inputType: 'reference_generation',
    hasStartImage: false,
    hasEndImage: false,
    hasReferenceImages: true,
    hasReferenceVideos: true,
    hasReferenceAudio: true,
    generateAudio: true,
    byteplusBillingInputType: 'video_input',
  }
);

console.log('byteplus-provider tests passed');
