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
import {
  buildNextBytePlusStorageCopyState,
  getBytePlusAccounting,
  getBytePlusStorageCopyState,
  getBytePlusUnitPriceUsdPer1kTokens,
  resolveBytePlusStorageCopyMaxAttempts,
  shouldRetryBytePlusStorageCopy,
} from '../../server/byteplus-poll';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '../../src/lib/seedance-2-pricing';
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

const videoEditPayload = buildBytePlusSeedancePayload({
  modelId: BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  prompt: 'Replace the product in Video 1 with the product from Image 1 while preserving the camera movement.',
  durationSec: 6,
  mode: 'v2v',
  referenceImageUrls: ['https://assets.example.com/product.png'],
  referenceVideoUrls: ['https://assets.example.com/source.mp4'],
  allowedResolutions: ['480p', '720p', '1080p'],
});

assert.deepEqual(videoEditPayload.content, [
  {
    type: 'text',
    text: 'Replace the product in Video 1 with the product from Image 1 while preserving the camera movement.',
  },
  {
    type: 'image_url',
    image_url: { url: 'https://assets.example.com/product.png' },
    role: 'reference_image',
  },
  {
    type: 'video_url',
    video_url: { url: 'https://assets.example.com/source.mp4' },
    role: 'reference_video',
  },
]);

const videoExtendPayload = buildBytePlusSeedancePayload({
  modelId: BYTEPLUS_SEEDANCE_DEFAULT_MODEL_ID,
  prompt: 'Extend Video 1 with a smooth cinematic continuation.',
  durationSec: 7,
  mode: 'extend',
  referenceVideoUrls: ['https://assets.example.com/source.mp4'],
  allowedResolutions: ['480p', '720p', '1080p'],
});

assert.deepEqual(videoExtendPayload.content, [
  {
    type: 'text',
    text: 'Extend Video 1 with a smooth cinematic continuation.',
  },
  {
    type: 'video_url',
    video_url: { url: 'https://assets.example.com/source.mp4' },
    role: 'reference_video',
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
      { id: 'duration', type: 'enum', label: 'Duration', values: ['auto', '4', '5', '6'], default: 'auto' },
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
  pricingDetails: {
    currency: 'USD',
    tokenPricing: {
      model: 'fal_tokens',
      unitPriceUsdPer1kTokens: 0.014,
      framesPerSecond: 24,
      defaultAspectRatio: '16:9',
      dimensions: {
        '480p': { '16:9': { width: 854, height: 480 } },
        '720p': { '16:9': { width: 1280, height: 720 } },
        '1080p': { '16:9': { width: 1920, height: 1080 } },
      },
    },
  },
  modeCaps: {
    t2v: { modes: ['t2v'], resolution: ['480p', '720p'], aspectRatio: ['auto', '16:9'] },
    i2v: { modes: ['i2v'], resolution: ['480p', '720p'], aspectRatio: ['auto', '16:9'] },
    ref2v: { modes: ['ref2v'], resolution: ['480p', '720p'], aspectRatio: ['auto', '16:9'] },
  },
} satisfies EngineCaps;

const bytePlusStandardEngine = applyBytePlusSeedanceRuntimeOptions(baseSeedanceEngine, {
  provider: 'byteplus_modelark',
  allowedModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
});

assert.deepEqual(bytePlusStandardEngine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
assert.deepEqual(bytePlusStandardEngine.resolutions, ['480p', '720p', '1080p']);
assert.deepEqual(bytePlusStandardEngine.aspectRatios, ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
assert.deepEqual(bytePlusStandardEngine.modeCaps?.ref2v?.resolution, ['480p', '720p', '1080p']);
assert.deepEqual(bytePlusStandardEngine.modeCaps?.v2v?.resolution, ['480p', '720p', '1080p']);
assert.deepEqual(bytePlusStandardEngine.modeCaps?.extend?.resolution, ['480p', '720p', '1080p']);
assert.deepEqual(bytePlusStandardEngine.modeCaps?.t2v?.duration, {
  options: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  default: 5,
});
assert.deepEqual(
  bytePlusStandardEngine.inputSchema?.optional?.find((field) => field.id === 'resolution')?.values,
  ['480p', '720p', '1080p']
);
assert.deepEqual(
  bytePlusStandardEngine.inputSchema?.optional?.find((field) => field.id === 'duration')?.values,
  ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
);
assert.equal(
  JSON.stringify(bytePlusStandardEngine.inputSchema?.optional?.find((field) => field.id === 'video_urls')).includes('Fal'),
  false
);
assert.equal(
  bytePlusStandardEngine.inputSchema?.optional?.find((field) => field.id === 'duration')?.default,
  '5'
);
assert.equal(
  bytePlusStandardEngine.inputSchema?.optional?.find((field) => field.id === 'aspect_ratio')?.default,
  '16:9'
);

if (!isSeedance2TokenPricing(bytePlusStandardEngine.pricingDetails)) {
  throw new Error('Expected Seedance 2 token pricing for BytePlus standard engine test.');
}
const standard1080pQuote = computeSeedance2TokenQuote({
  details: bytePlusStandardEngine.pricingDetails,
  durationSec: 5,
  resolution: '1080p',
  aspectRatio: '16:9',
});
assert.equal(standard1080pQuote.width, 1920);
assert.equal(standard1080pQuote.height, 1080);

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

assert.deepEqual(
  getBytePlusAccounting({
    has_audio: true,
    settings_snapshot: {
      inputMode: 'v2v',
      refs: {
        referenceImages: ['https://assets.example.com/product.png'],
        videoUrls: ['https://assets.example.com/source.mp4'],
      },
    },
  }),
  {
    mode: 'v2v',
    inputType: 'video_edit',
    hasStartImage: false,
    hasEndImage: false,
    hasReferenceImages: true,
    hasReferenceVideos: true,
    hasReferenceAudio: false,
    generateAudio: true,
    byteplusBillingInputType: 'video_input',
  }
);

assert.deepEqual(
  getBytePlusAccounting({
    has_audio: false,
    settings_snapshot: {
      inputMode: 'extend',
      refs: {
        videoUrls: ['https://assets.example.com/source.mp4'],
      },
    },
  }),
  {
    mode: 'extend',
    inputType: 'video_extension',
    hasStartImage: false,
    hasEndImage: false,
    hasReferenceImages: false,
    hasReferenceVideos: true,
    hasReferenceAudio: false,
    generateAudio: false,
    byteplusBillingInputType: 'video_input',
  }
);

assert.equal(resolveBytePlusStorageCopyMaxAttempts('3'), 3);
assert.equal(resolveBytePlusStorageCopyMaxAttempts('0'), 6);
assert.deepEqual(getBytePlusStorageCopyState({}), {
  attempts: 0,
  firstFailedAt: null,
  lastFailedAt: null,
  lastProviderStatus: null,
  lastReason: null,
});
assert.deepEqual(
  buildNextBytePlusStorageCopyState(
    {
      byteplusStorageCopy: {
        attempts: 1,
        firstFailedAt: '2026-05-02T18:10:00.000Z',
      },
    },
    {
      nowIso: '2026-05-02T18:12:00.000Z',
      providerStatus: 'succeeded',
      reason: 'provider_video_copy_failed',
    }
  ),
  {
    attempts: 2,
    firstFailedAt: '2026-05-02T18:10:00.000Z',
    lastFailedAt: '2026-05-02T18:12:00.000Z',
    lastProviderStatus: 'succeeded',
    lastReason: 'provider_video_copy_failed',
  }
);
assert.equal(
  shouldRetryBytePlusStorageCopy({
    state: { attempts: 2 },
    createdAt: '2026-05-02T18:00:00.000Z',
    nowMs: Date.parse('2026-05-02T18:12:00.000Z'),
    maxAttempts: 3,
  }),
  true
);
assert.equal(
  shouldRetryBytePlusStorageCopy({
    state: { attempts: 3 },
    createdAt: '2026-05-02T18:00:00.000Z',
    nowMs: Date.parse('2026-05-02T18:12:00.000Z'),
    maxAttempts: 3,
  }),
  false
);
assert.equal(
  shouldRetryBytePlusStorageCopy({
    state: { attempts: 1 },
    createdAt: '2026-05-01T18:00:00.000Z',
    nowMs: Date.parse('2026-05-02T18:30:00.000Z'),
    maxAttempts: 6,
    copyWindowMs: 23 * 60 * 60_000,
  }),
  false
);

console.log('byteplus-provider tests passed');
