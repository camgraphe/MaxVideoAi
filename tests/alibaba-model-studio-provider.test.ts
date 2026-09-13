import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAlibabaDirectEngine,
  resolveAlibabaModelRoute,
} from '../frontend/src/server/video-providers/alibaba-model-studio/model-map';
import { estimateAlibabaProviderCost } from '../frontend/src/server/video-providers/alibaba-model-studio/cost';
import {
  AlibabaModelStudioClient,
  normalizeAlibabaBaseUrl,
} from '../frontend/src/server/video-providers/alibaba-model-studio/client';
import {
  AlibabaModelStudioError,
  classifyAlibabaModelStudioError,
  shouldFallbackFromAlibabaSubmit,
} from '../frontend/src/server/video-providers/alibaba-model-studio/errors';
import { buildAlibabaVideoPayload } from '../frontend/src/server/video-providers/alibaba-model-studio/payload';
import { normalizeAlibabaTask } from '../frontend/src/server/video-providers/alibaba-model-studio/response';

test('Alibaba model routing maps only the approved canonical engines and modes', () => {
  assert.deepEqual(resolveAlibabaModelRoute('wan-3', 't2v'), {
    model: 'wan3.0-video',
    family: 'wan3',
    mode: 't2v',
    fallbackCompatible: true,
  });
  assert.deepEqual(resolveAlibabaModelRoute('wan-3-prime', 'extend'), {
    model: 'wan3.0-video-prime',
    family: 'wan3',
    mode: 'extend',
    fallbackCompatible: false,
  });
  assert.deepEqual(resolveAlibabaModelRoute('happy-horse-1-1', 'ref2v'), {
    model: 'happyhorse-1.1-r2v',
    family: 'happyhorse11',
    mode: 'ref2v',
    fallbackCompatible: true,
  });
  assert.equal(resolveAlibabaModelRoute('wan-2-6', 't2v'), null);
  assert.equal(resolveAlibabaModelRoute('happy-horse-1-0', 'v2v'), null);
  assert.equal(isAlibabaDirectEngine('wan-3'), true);
  assert.equal(isAlibabaDirectEngine('wan-3-prime'), true);
  assert.equal(isAlibabaDirectEngine('happy-horse-1-1'), true);
  assert.equal(isAlibabaDirectEngine('wan-2-6'), false);
});

test('Wan 3 factual cost includes input and output video duration', () => {
  assert.deepEqual(estimateAlibabaProviderCost({
    engineId: 'wan-3',
    mode: 'ref2v',
    durationSec: 10,
    inputVideoDurationSec: 5,
    resolution: '720p',
  }), {
    providerCostUnits: 15,
    providerCostUsd: 1.5,
    source: 'alibaba_singapore_2026-09-12',
  });

  assert.equal(estimateAlibabaProviderCost({
    engineId: 'wan-3-prime',
    mode: 't2v',
    durationSec: 10,
    inputVideoDurationSec: 0,
    resolution: '1080p',
  }).providerCostUsd, 2.8);
});

test('HappyHorse 1.1 factual cost bills output duration only', () => {
  assert.deepEqual(estimateAlibabaProviderCost({
    engineId: 'happy-horse-1-1',
    mode: 'i2v',
    durationSec: 5,
    inputVideoDurationSec: 9,
    resolution: '1080p',
  }), {
    providerCostUnits: 5,
    providerCostUsd: 0.9,
    source: 'alibaba_singapore_2026-09-12',
  });
});

test('Alibaba factual cost rejects unmapped models and resolutions', () => {
  assert.throws(() => estimateAlibabaProviderCost({
    engineId: 'wan-2-6',
    mode: 't2v',
    durationSec: 5,
    resolution: '720p',
  }), /not mapped to Alibaba Model Studio/);

  assert.throws(() => estimateAlibabaProviderCost({
    engineId: 'wan-3',
    mode: 't2v',
    durationSec: 5,
    resolution: '4k',
  }), /Unsupported Alibaba resolution/);
});

test('Wan 3 payload translates text and typed reference media into DashScope shape', () => {
  assert.deepEqual(buildAlibabaVideoPayload({
    engineId: 'wan-3',
    mode: 'ref2v',
    prompt: 'A tracking shot through a quiet workshop',
    durationSec: 12,
    resolution: '1080p',
    aspectRatio: '16:9',
    audioEnabled: true,
    referenceImageUrls: ['https://media.example/reference.png'],
    referenceVideoUrls: ['https://media.example/motion.mp4'],
    referenceAudioUrls: ['https://media.example/voice.mp3'],
    promptExtend: false,
    seed: 42,
  }), {
    model: 'wan3.0-video',
    input: {
      prompt: 'A tracking shot through a quiet workshop',
      media: [
        { type: 'reference_image', url: 'https://media.example/reference.png' },
        { type: 'reference_video', url: 'https://media.example/motion.mp4' },
        { type: 'reference_audio', url: 'https://media.example/voice.mp3' },
      ],
    },
    parameters: {
      resolution: '1080P',
      ratio: '16:9',
      duration: 12,
      audio: true,
      prompt_extend: false,
      watermark: false,
      seed: 42,
    },
  });
});

test('Wan 3 frame interpolation uses first and last frame and rejects mixed references', () => {
  assert.deepEqual(buildAlibabaVideoPayload({
    engineId: 'wan-3-prime',
    mode: 'i2v',
    prompt: 'The camera slowly pulls back',
    durationSec: 8,
    resolution: '720p',
    aspectRatio: 'adaptive',
    startImageUrl: 'https://media.example/start.jpg',
    endImageUrl: 'https://media.example/end.jpg',
  }), {
    model: 'wan3.0-video-prime',
    input: {
      prompt: 'The camera slowly pulls back',
      media: [
        { type: 'first_frame', url: 'https://media.example/start.jpg' },
        { type: 'last_frame', url: 'https://media.example/end.jpg' },
      ],
    },
    parameters: {
      resolution: '720P',
      ratio: 'adaptive',
      duration: 8,
      audio: false,
      prompt_extend: true,
      watermark: false,
    },
  });

  assert.throws(() => buildAlibabaVideoPayload({
    engineId: 'wan-3',
    mode: 'i2v',
    prompt: 'Move',
    durationSec: 5,
    resolution: '720p',
    startImageUrl: 'https://media.example/start.jpg',
    referenceAudioUrls: ['https://media.example/audio.mp3'],
  }), /cannot combine frame interpolation with reference media/);
});

test('Wan 3 edit and extension require source video and enforce the 30 second total', () => {
  assert.throws(() => buildAlibabaVideoPayload({
    engineId: 'wan-3',
    mode: 'extend',
    prompt: 'Continue the motion',
    durationSec: 20,
    inputVideoDurationSec: 12,
    resolution: '720p',
    referenceVideoUrls: ['https://media.example/source.mp4'],
  }), /must not exceed 30 seconds/);

  assert.throws(() => buildAlibabaVideoPayload({
    engineId: 'wan-3',
    mode: 'v2v',
    prompt: 'Restyle the footage',
    durationSec: 5,
    resolution: '720p',
  }), /requires exactly one source video/);
});

test('HappyHorse selects its mode model and omits unsupported ratio for I2V', () => {
  assert.deepEqual(buildAlibabaVideoPayload({
    engineId: 'happy-horse-1-1',
    mode: 'i2v',
    prompt: 'A horse trots into frame',
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    startImageUrl: 'https://media.example/horse.jpg',
    seed: 7,
  }), {
    model: 'happyhorse-1.1-i2v',
    input: {
      prompt: 'A horse trots into frame',
      media: [{ type: 'first_frame', url: 'https://media.example/horse.jpg' }],
    },
    parameters: {
      resolution: '720P',
      duration: 5,
      watermark: false,
      seed: 7,
    },
  });
});

test('HappyHorse validates mode-specific requirements and duration', () => {
  assert.throws(() => buildAlibabaVideoPayload({
    engineId: 'happy-horse-1-1',
    mode: 'ref2v',
    prompt: '',
    durationSec: 5,
    resolution: '720p',
    referenceImageUrls: ['https://media.example/horse.jpg'],
  }), /requires a prompt/);

  assert.throws(() => buildAlibabaVideoPayload({
    engineId: 'happy-horse-1-1',
    mode: 't2v',
    prompt: 'Run',
    durationSec: 16,
    resolution: '720p',
  }), /between 3 and 15 seconds/);
});

test('Alibaba task responses normalize lifecycle, output, usage, and failures', () => {
  assert.deepEqual(normalizeAlibabaTask({
    request_id: 'request-1',
    output: {
      task_id: 'task-123',
      task_status: 'SUCCEEDED',
      video_url: 'https://cdn.example/result.mp4',
    },
    usage: {
      duration: 15,
      input_video_duration: 5,
      output_video_duration: 10,
      video_count: 1,
    },
  }), {
    providerJobId: 'task-123',
    status: 'completed',
    rawStatus: 'SUCCEEDED',
    videoUrl: 'https://cdn.example/result.mp4',
    message: null,
    errorCode: null,
    usage: { totalTokens: null, completionTokens: null },
    providerCostUnits: 15,
    raw: {
      request_id: 'request-1',
      output: {
        task_id: 'task-123',
        task_status: 'SUCCEEDED',
        video_url: 'https://cdn.example/result.mp4',
      },
      usage: {
        duration: 15,
        input_video_duration: 5,
        output_video_duration: 10,
        video_count: 1,
      },
    },
  });

  const failed = normalizeAlibabaTask({
    output: {
      task_id: 'task-456',
      task_status: 'FAILED',
      code: 'DataInspectionFailed',
      message: 'The input failed content inspection.',
    },
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failed.errorCode, 'DataInspectionFailed');
  assert.equal(failed.message, 'The input failed content inspection.');
});

test('Alibaba errors only allow pre-acceptance transient fallback', () => {
  const rateLimit = new AlibabaModelStudioError('Alibaba Model Studio request failed.', {
    status: 429,
    body: { code: 'Throttling.RateQuota', message: 'Too many requests' },
  });
  assert.equal(classifyAlibabaModelStudioError(rateLimit).fallbackEligible, true);
  assert.equal(shouldFallbackFromAlibabaSubmit({
    error: rateLimit,
    acceptedProviderJobId: null,
    fallbackToFalEnabled: true,
  }), true);
  assert.equal(shouldFallbackFromAlibabaSubmit({
    error: rateLimit,
    acceptedProviderJobId: 'task-already-accepted',
    fallbackToFalEnabled: true,
  }), false);

  const moderation = new AlibabaModelStudioError('Alibaba Model Studio request failed.', {
    status: 400,
    body: { code: 'DataInspectionFailed', message: 'Content policy violation' },
  });
  assert.equal(classifyAlibabaModelStudioError(moderation).errorClass, 'moderation');
  assert.equal(classifyAlibabaModelStudioError(moderation).fallbackEligible, false);

  const auth = new AlibabaModelStudioError('Alibaba Model Studio request failed.', {
    status: 401,
    body: { code: 'InvalidApiKey', message: 'Invalid API key' },
  });
  assert.equal(classifyAlibabaModelStudioError(auth).fallbackEligible, false);
});

test('Alibaba client uses the Singapore DashScope async contract without leaking credentials', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({
      request_id: 'request-1',
      output: { task_id: 'task-123', task_status: 'PENDING' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = new AlibabaModelStudioClient({
    apiKey: 'super-secret-key',
    baseUrl: 'https://dashscope-intl.ap-southeast-1.aliyuncs.com',
    fetchFn: fakeFetch,
  });

  const result = await client.createVideo({
    model: 'wan3.0-video',
    input: { prompt: 'A scene' },
    parameters: {
      resolution: '720P',
      ratio: '16:9',
      duration: 5,
      audio: false,
      prompt_extend: true,
      watermark: false,
    },
  });
  assert.equal(result.providerJobId, 'task-123');
  assert.equal(requests[0]?.url, 'https://dashscope-intl.ap-southeast-1.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis');
  assert.equal(new Headers(requests[0]?.init?.headers).get('Authorization'), 'Bearer super-secret-key');
  assert.equal(new Headers(requests[0]?.init?.headers).get('X-DashScope-Async'), 'enable');

  assert.throws(
    () => normalizeAlibabaBaseUrl('https://dashscope.aliyuncs.com'),
    /Singapore endpoint/
  );
  assert.throws(
    () => normalizeAlibabaBaseUrl('http://dashscope-intl.ap-southeast-1.aliyuncs.com'),
    /HTTPS/
  );
});
