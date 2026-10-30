import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratePayload, GenerateResult } from '../frontend/src/lib/fal-types';
import { AlibabaModelStudioError } from '../frontend/src/server/video-providers/alibaba-model-studio/errors';
import type { NormalizedVideoProviderTask } from '../frontend/src/server/video-providers/types';
import { submitAlibabaModelStudioGenerateTask } from '../frontend/app/api/generate/_lib/alibaba-model-studio-submission';

type QueryEntry = { sql: string; params: unknown[] };

function createQueryRecorder(options?: { failAppJobUpdateAfterAcceptance?: boolean }) {
  const queries: QueryEntry[] = [];
  let nextAttemptId = 1;
  const queryFn = async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
    queries.push({ sql, params });
    if (/INSERT INTO provider_attempts/.test(sql)) {
      return [{ id: nextAttemptId++, attempt_index: params[1] }] as T[];
    }
    if (options?.failAppJobUpdateAfterAcceptance && /UPDATE app_jobs/.test(sql) && params.includes('alibaba_model_studio')) {
      throw new Error('database write failed after provider acceptance');
    }
    return [] as T[];
  };
  return { queries, queryFn };
}

const falPayload: GeneratePayload = {
  engineId: 'wan-3',
  prompt: 'A cinematic harbor at blue hour',
  mode: 't2v',
  durationSec: 5,
  aspectRatio: '16:9',
  resolution: '720p',
};

function acceptedTask(): NormalizedVideoProviderTask {
  return {
    providerJobId: 'task_alibaba_123',
    status: 'queued',
    rawStatus: 'PENDING',
    videoUrl: null,
    message: null,
    usage: { totalTokens: null, completionTokens: null },
    raw: { output: { task_id: 'task_alibaba_123', task_status: 'PENDING' } },
  };
}

function baseParams(overrides: Record<string, unknown> = {}) {
  const logEvents: Array<{ kind: string; event?: unknown }> = [];
  return {
    params: {
      jobId: 'job_alibaba_test',
      userId: 'user_123',
      engineId: 'wan-3',
      engineLabel: 'Wan 3',
      mode: 't2v' as const,
      prompt: 'A cinematic harbor at blue hour',
      negativePrompt: null,
      durationSec: 5,
      aspectRatio: '16:9',
      audioEnabled: false,
      effectiveResolution: '720p',
      imageUrl: null,
      placeholderThumb: '/assets/frames/thumb-16x9.svg',
      pricing: { totalCents: 130, currency: 'usd' },
      paymentStatus: 'paid',
      pendingReceipt: null,
      paymentMode: 'wallet' as const,
      walletChargeReserved: false,
      fallbackToFalEnabled: true,
      falPayload,
      falInputSummary: { hasImage: false, hasVideo: false, imageCount: 0, videoCount: 0 },
      isLumaRay2: false,
      batchId: null,
      groupId: null,
      iterationIndex: null,
      iterationCount: null,
      renderIds: null,
      heroRenderId: null,
      localKey: null,
      logMetricFn(kind: 'accepted' | 'failed' | 'rejected' | 'completed', event?: unknown) {
        logEvents.push({ kind, event });
      },
      ...overrides,
    },
    logEvents,
  };
}

test('Alibaba submission records one accepted direct attempt on the existing app job', async () => {
  const { queries, queryFn } = createQueryRecorder();
  const { params } = baseParams({
    deps: {
      queryFn,
      getAlibabaModelStudioClientFn: () => ({
        createVideo: async () => acceptedTask(),
        getTask: async () => acceptedTask(),
      }),
    },
  });

  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'accepted');
  assert.equal(result.body.provider, 'alibaba_model_studio');
  assert.equal(result.body.providerJobId, 'task_alibaba_123');
  assert.equal(queries.filter((entry) => /INSERT INTO provider_attempts/.test(entry.sql)).length, 1);
});

test('Alibaba submission keeps projected image frames out of reference media', async () => {
  const { queryFn } = createQueryRecorder();
  let submittedPayload: unknown = null;
  const start = 'https://media.example/start.png';
  const end = 'https://media.example/end.png';
  const { params } = baseParams({
    mode: 'i2v', imageUrl: start,
    falPayload: {
      ...falPayload, mode: 'i2v', imageUrl: start, endImageUrl: end,
      inputs: [
        { name: 'start.png', type: 'image/png', size: 1000, kind: 'image', slotId: 'start_image_url', url: start },
        { name: 'end.png', type: 'image/png', size: 1000, kind: 'image', slotId: 'end_image_url', url: end },
      ],
    },
    deps: {
      queryFn,
      getAlibabaModelStudioClientFn: () => ({
        createVideo: async (payload: unknown) => { submittedPayload = payload; return acceptedTask(); },
        getTask: async () => acceptedTask(),
      }),
    },
  });
  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual((submittedPayload as { input?: { media?: unknown[] } })?.input?.media, [
    { type: 'first_frame', url: start }, { type: 'last_frame', url: end },
  ]);
});

test('Alibaba submission forwards the Wan prompt expansion selection', async () => {
  const { queryFn } = createQueryRecorder();
  let submittedPayload: unknown = null;
  const { params } = baseParams({
    engineId: 'wan-3-prime', engineLabel: 'Wan 3 Prime', mode: 'ref2v',
    falPayload: {
      ...falPayload,
      engineId: 'wan-3-prime', mode: 'ref2v',
      referenceImages: ['https://media.example/reference.png'],
      extraInputValues: { enable_prompt_expansion: false },
    },
    deps: {
      queryFn,
      getAlibabaModelStudioClientFn: () => ({
        createVideo: async (payload: unknown) => {
          submittedPayload = payload;
          return acceptedTask();
        },
        getTask: async () => acceptedTask(),
      }),
    },
  });

  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true);
  assert.equal((submittedPayload as { parameters?: { prompt_extend?: boolean } })?.parameters?.prompt_extend, false);
});

test('Alibaba submission forwards a Wan document URL as direct media', async () => {
  const { queryFn } = createQueryRecorder();
  let submittedPayload: unknown = null;
  const { params } = baseParams({
    engineId: 'wan-3-prime', engineLabel: 'Wan 3 Prime', mode: 'ref2v',
    falPayload: {
      ...falPayload,
      engineId: 'wan-3-prime', mode: 'ref2v',
      extraInputValues: { file_url: 'https://media.example/brief.pdf' },
    },
    deps: {
      queryFn,
      getAlibabaModelStudioClientFn: () => ({
        createVideo: async (payload: unknown) => {
          submittedPayload = payload;
          return acceptedTask();
        },
        getTask: async () => acceptedTask(),
      }),
    },
  });

  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true);
  assert.deepEqual(
    (submittedPayload as { input?: { media?: unknown[] } })?.input?.media,
    [{ type: 'file', url: 'https://media.example/brief.pdf' }],
  );
});

test('Wan reference audio format failure explains MP3/WAV before provider submission', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let providerCalls = 0;
  const audioUrl = 'https://media.example/voice.m4a';
  const { params } = baseParams({
    engineId: 'wan-3-prime', engineLabel: 'Wan 3 Prime', mode: 'ref2v',
    falPayload: {
      ...falPayload,
      engineId: 'wan-3-prime', mode: 'ref2v',
      referenceImages: ['https://media.example/reference.jpg'],
      audioUrl,
      inputs: [{ name: 'voice.m4a', type: 'audio/mp4', size: 1000, kind: 'audio', slotId: 'reference_audio_urls', url: audioUrl }],
    },
    deps: {
      queryFn,
      getAlibabaModelStudioClientFn: () => ({
        createVideo: async () => { providerCalls += 1; return acceptedTask(); },
        getTask: async () => acceptedTask(),
      }),
    },
  });

  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, false);
  assert.equal(result.body.error, 'ALIBABA_REFERENCE_AUDIO_UNSUPPORTED');
  assert.match(String(result.body.message), /MP3 or WAV/);
  assert.equal(providerCalls, 0);
  assert.equal(queries.some(({ sql, params: values }) =>
    /UPDATE app_jobs/.test(sql) && values.includes(result.body.message)), true);
});

test('Alibaba submission falls back once for a retryable error before acceptance', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let falCalls = 0;
  const falResult: GenerateResult = {
    provider: 'fal',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    providerJobId: 'fal_after_alibaba',
    status: 'queued',
    progress: 10,
  };
  const { params } = baseParams({
    deps: {
      queryFn,
      getAlibabaModelStudioClientFn: () => ({
        createVideo: async () => {
          throw new AlibabaModelStudioError('Rate limited', {
            status: 429,
            body: { code: 'Throttling.RateQuota', message: 'Too many requests' },
          });
        },
        getTask: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async falParams => {
        assert.equal(falParams.userId, 'user_123');
        falCalls += 1;
        return { ok: true, generationResult: falResult };
      },
    },
  });

  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'fal_result');
  assert.equal(falCalls, 1);
  assert.equal(queries.filter((entry) => /INSERT INTO provider_attempts/.test(entry.sql)).length, 2);
  assert.equal(queries.some((entry) => entry.params.includes('fallback_started')), true);
});

test('Alibaba submission never falls back after a provider task ID was accepted', async () => {
  const { queryFn, queries } = createQueryRecorder({ failAppJobUpdateAfterAcceptance: true });
  let falCalls = 0;
  let rollbackCalls = 0;
  const { params } = baseParams({
    deps: {
      queryFn,
      rollbackPendingPaymentFn: async () => { rollbackCalls++; },
      getAlibabaModelStudioClientFn: () => ({
        createVideo: async () => acceptedTask(),
        getTask: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalls += 1;
        return { ok: true, generationResult: { provider: 'fal', thumbUrl: '/thumb.svg' } };
      },
    },
  });

  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'accepted') assert.fail('keep the accepted identity while persistence is unavailable');
  assert.equal(result.body.jobId, params.jobId);
  assert.equal(result.body.providerJobId, 'task_alibaba_123');
  assert.equal(result.body.provider, 'alibaba_model_studio');
  assert.equal(result.body.deferred, true);
  assert.equal(Object.hasOwn(result.body, 'paymentStatus'), false);
  assert.equal(falCalls, 0);
  assert.equal(rollbackCalls, 0);
  assert.equal(queries.some(entry => /UPDATE provider_attempts/.test(entry.sql) && entry.params[1] === 'failed'), false);
});

test('Alibaba submission does not fallback on moderation or authentication errors', async () => {
  for (const providerError of [
    new AlibabaModelStudioError('Moderation', {
      status: 400,
      body: { code: 'DataInspectionFailed', message: 'Content policy violation' },
    }),
    new AlibabaModelStudioError('Authentication', {
      status: 401,
      body: { code: 'InvalidApiKey', message: 'Invalid API key' },
    }),
  ]) {
    const { queryFn } = createQueryRecorder();
    let falCalls = 0;
    const { params } = baseParams({
      deps: {
        queryFn,
        getAlibabaModelStudioClientFn: () => ({
          createVideo: async () => { throw providerError; },
          getTask: async () => acceptedTask(),
        }),
        submitFalGenerateTaskFn: async () => {
          falCalls += 1;
          return { ok: true, generationResult: { provider: 'fal', thumbUrl: '/thumb.svg' } };
        },
      },
    });
    const result = await submitAlibabaModelStudioGenerateTask(params);
    assert.equal(result.ok, false);
    assert.equal(falCalls, 0);
  }
});

for (const engineId of ['wan-3', 'wan-3-prime']) {
  for (const mode of ['v2v', 'extend', 'ref2v'] as const) {
    test(`${engineId} ${mode} sends a temporary grant without changing reusable inputs or price`, async () => {
      const { queries, queryFn } = createQueryRecorder();
      const canonical = 'https://private.example/media-assets/user_123/video-excerpts-private-v3-source.mp4';
      const signed = `${canonical}?X-Amz-Signature=transport-secret`;
      const original = { ...falPayload, engineId, mode, videoUrl: canonical,
        inputs: [{ kind: 'video', slotId: 'video_url', url: canonical, name: 'source.mp4', type: 'video/mp4', size: 5000, durationSec: 6 }] };
      const before = structuredClone(original);
      let submitted = 0;
      const { params } = baseParams({ engineId, mode, durationSec: 6, falPayload: original, deps: {
        queryFn,
        createOwnedMediaReadUrlFn: async (input: { url: string; userId?: string; expiresInSeconds?: number }) => {
          assert.equal(input.url, canonical); assert.equal(input.userId, 'user_123'); assert.equal(input.expiresInSeconds, 3600);
          return signed;
        },
        getAlibabaModelStudioClientFn: () => ({ createVideo: async (payload: { input: { media: { url: string }[] }; parameters: { duration: number } }) => {
          submitted++;
          assert.equal(payload.input.media[0].url, signed); assert.equal(payload.parameters.duration, 6);
          return { ...acceptedTask(), raw: { output: { task_id: 'task_alibaba_123' }, message: `Read ${signed}`, nested: encodeURIComponent(signed) } };
        }, getTask: async () => acceptedTask() }),
      } });
      const result = await submitAlibabaModelStudioGenerateTask(params);
      assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(submitted, 1);
      assert.deepEqual(original, before); assert.deepEqual(result.body.pricing, params.pricing);
      assert.doesNotMatch(JSON.stringify({ queries, result }), /X-Amz|transport-secret/);
    });
  }
}

test('Wan local media access failures neither submit nor invoke Fal fallback', async () => {
  for (const message of ['MEDIA_NOT_AVAILABLE', 'network timeout signing']) {
    const { queryFn } = createQueryRecorder();
    let providerCalls = 0;
    let fallbackCalls = 0;
    const { params } = baseParams({ mode: 'i2v', imageUrl: 'https://private.example/other-owner/image.png', deps: {
      queryFn,
      createOwnedMediaReadUrlFn: async () => { throw new Error(message); },
      getAlibabaModelStudioClientFn: () => ({ createVideo: async () => { providerCalls++; return acceptedTask(); }, getTask: async () => acceptedTask() }),
      submitFalGenerateTaskFn: async () => { fallbackCalls++; throw new Error('unexpected fallback'); },
    } });
    const result = await submitAlibabaModelStudioGenerateTask(params);
    assert.equal(result.ok, false); assert.equal(providerCalls, 0); assert.equal(fallbackCalls, 0);
    assert.equal(result.body.error, message === 'MEDIA_NOT_AVAILABLE' ? 'REFERENCE_INVALID' : 'REFERENCE_ACCESS_FAILED');
  }
});

test('Wan retryable provider errors are sanitized and Fal receives canonical inputs', async () => {
  const { queries, queryFn } = createQueryRecorder();
  const canonical = 'https://private.example/media-assets/user_123/image.png';
  const signed = `${canonical}?X-Amz-Signature=fallback-secret`;
  let fallbackCalls = 0;
  const { params } = baseParams({ mode: 'i2v', imageUrl: canonical, falPayload: { ...falPayload, mode: 'i2v', imageUrl: canonical }, deps: {
    queryFn, createOwnedMediaReadUrlFn: async () => signed,
    getAlibabaModelStudioClientFn: () => ({ createVideo: async () => { throw new AlibabaModelStudioError(`Failed ${signed}`, {
      status: 429, body: { message: `Failed ${signed}`, nested: encodeURIComponent(signed) },
    }); }, getTask: async () => acceptedTask() }),
    submitFalGenerateTaskFn: async (input: { falPayload: GeneratePayload }) => {
      fallbackCalls++; assert.equal(input.falPayload.imageUrl, canonical);
      return { ok: true, generationResult: { provider: 'fal', thumbUrl: '/thumb.svg' } };
    },
  } });
  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true); assert.equal(fallbackCalls, 1);
  assert.doesNotMatch(JSON.stringify({ queries, result }), /X-Amz|fallback-secret/);
});

test('HappyHorse direct submission remains unchanged and never enters Wan media access', async () => {
  const { queryFn } = createQueryRecorder();
  const canonical = 'https://media.example/horse.png';
  const { params } = baseParams({ engineId: 'happy-horse-1-1', mode: 'i2v', imageUrl: canonical, deps: {
    queryFn, createOwnedMediaReadUrlFn: async () => { throw new Error('must not sign'); },
    getAlibabaModelStudioClientFn: () => ({ createVideo: async (payload: { input: { media: { url: string }[] } }) => {
      assert.equal(payload.input.media[0].url, canonical); return acceptedTask();
    }, getTask: async () => acceptedTask() }),
  } });
  const result = await submitAlibabaModelStudioGenerateTask(params);
  assert.equal(result.ok, true, JSON.stringify(result));
});
