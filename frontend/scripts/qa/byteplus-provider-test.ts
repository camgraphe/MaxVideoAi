import assert from 'node:assert/strict';

import {
  buildBytePlusSeedanceFastPayload,
  getBytePlusUserSafeErrorMessage,
  normalizeBytePlusTask,
  scrubBytePlusError,
} from '../../src/server/video-providers/byteplus-modelark';
import { getBytePlusAccounting } from '../../server/byteplus-poll';

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
    generateAudio: false,
    byteplusBillingInputType: 'no_video_input',
  }
);

console.log('byteplus-provider tests passed');
