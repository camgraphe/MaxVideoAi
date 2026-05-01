import assert from 'node:assert/strict';

import {
  buildBytePlusSeedanceFastPayload,
  normalizeBytePlusTask,
  scrubBytePlusError,
} from '../../src/server/video-providers/byteplus-modelark';

const payload = buildBytePlusSeedanceFastPayload({
  modelId: 'dreamina-seedance-2-0-fast-260128',
  prompt: 'A concise product video prompt',
  durationSec: 5,
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

console.log('byteplus-provider tests passed');
