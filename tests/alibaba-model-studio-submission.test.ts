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
      submitFalGenerateTaskFn: async () => {
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
  const { queryFn } = createQueryRecorder({ failAppJobUpdateAfterAcceptance: true });
  let falCalls = 0;
  const { params } = baseParams({
    deps: {
      queryFn,
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
  assert.equal(result.ok, false);
  assert.equal(falCalls, 0);
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
