import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratePayload, GenerateResult } from '../frontend/src/lib/fal-types';
import type { NormalizedVideoProviderTask } from '../frontend/src/server/video-providers/types';
import { LumaAgentsError } from '../frontend/src/server/video-providers/luma-agents/errors';
import { submitLumaAgentsGenerateTask } from '../frontend/app/api/generate/_lib/luma-agents-submission';

type QueryEntry = { sql: string; params: unknown[] };

function createQueryRecorder() {
  const queries: QueryEntry[] = [];
  let nextAttemptId = 1;
  const queryFn = async <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> => {
    queries.push({ sql, params });
    if (/INSERT INTO provider_attempts/.test(sql)) {
      return [{ id: nextAttemptId++, attempt_index: params[1] }] as T[];
    }
    return [] as T[];
  };
  return { queries, queryFn };
}

const falPayload: GeneratePayload = {
  engineId: 'luma-ray-3-2',
  prompt: 'A cinematic tram at night',
  mode: 't2v',
  durationSec: 5,
  durationOption: '5s',
  aspectRatio: '16:9',
  resolution: '720p',
  loop: true,
};

function baseParams(overrides: Partial<Parameters<typeof submitLumaAgentsGenerateTask>[0]> = {}) {
  const logEvents: Array<{ kind: string; event?: unknown }> = [];
  return {
    params: {
      jobId: 'job_luma_test',
      userId: 'user_123',
      engineId: 'luma-ray-3-2',
      engineLabel: 'Luma Ray 3.2',
      mode: 't2v' as const,
      prompt: 'A cinematic tram at night',
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
      advancedDirectOnlyEnabled: false,
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

function acceptedTask(): NormalizedVideoProviderTask {
  return {
    providerJobId: 'gen_luma_123',
    status: 'queued',
    rawStatus: 'queued',
    videoUrl: null,
    message: null,
    usage: null,
    raw: { id: 'gen_luma_123', state: 'queued' },
  };
}

test('Luma Agents submission records a direct accepted provider attempt', async () => {
  const { queries, queryFn } = createQueryRecorder();
  const { params, logEvents } = baseParams({
    deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => acceptedTask(),
        getGeneration: async () => acceptedTask(),
      }),
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'accepted');
  assert.equal(result.body.provider, 'luma_agents_direct');
  assert.equal(result.body.providerJobId, 'gen_luma_123');
  assert.equal(
    queries.some((entry) => /INSERT INTO provider_attempts/.test(entry.sql) && entry.params[2] === 'luma_agents_direct'),
    true
  );
  assert.equal(
    queries.some((entry) => /UPDATE app_jobs/.test(entry.sql) && entry.params.includes('luma_agents_direct')),
    true
  );
  assert.equal(logEvents.some((event) => event.kind === 'accepted'), true);
});

test('Luma Agents submission routes fal-compatible direct-unsupported payloads straight to fal', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let directCalled = false;
  let falCalled = false;
  const falResult: GenerateResult = {
    provider: 'fal',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    providerJobId: 'fal_123',
    status: 'queued',
    progress: 10,
  };
  const { params } = baseParams({
    aspectRatio: '3:1',
    falPayload: { ...falPayload, aspectRatio: '3:1' },
    deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => {
          directCalled = true;
          return acceptedTask();
        },
        getGeneration: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalled = true;
        return { ok: true, generationResult: falResult };
      },
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'fal_result');
  assert.equal(falCalled, true);
  assert.equal(directCalled, false);
  assert.equal(queries.some((entry) => /INSERT INTO provider_attempts/.test(entry.sql)), false);
});

test('Luma Agents submission routes looped end-frame i2v straight to fal', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let directCalled = false;
  let falCalled = false;
  const falResult: GenerateResult = {
    provider: 'fal',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    providerJobId: 'fal_loop_end_frame',
    status: 'queued',
    progress: 10,
  };
  const { params } = baseParams({
    mode: 'i2v',
    imageUrl: 'https://cdn.maxvideoai.com/start.png',
    falPayload: {
      ...falPayload,
      mode: 'i2v',
      imageUrl: 'https://cdn.maxvideoai.com/start.png',
      endImageUrl: 'https://cdn.maxvideoai.com/end.png',
      loop: true,
    },
    falInputSummary: { hasImage: true, hasVideo: false, imageCount: 2, videoCount: 0 },
    deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => {
          directCalled = true;
          return acceptedTask();
        },
        getGeneration: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalled = true;
        return { ok: true, generationResult: falResult };
      },
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'fal_result');
  assert.equal(falCalled, true);
  assert.equal(directCalled, false);
  assert.equal(queries.some((entry) => /INSERT INTO provider_attempts/.test(entry.sql)), false);
});

test('Luma Agents submission falls back to fal for rate limits before direct acceptance', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let falCalled = false;
  const falResult: GenerateResult = {
    provider: 'fal',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    providerJobId: 'fal_after_luma',
    status: 'queued',
    progress: 10,
  };
  const { params } = baseParams({
    deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => {
          throw new LumaAgentsError('Rate limit exceeded', {
            status: 429,
            body: { detail: 'Rate limit exceeded' },
          });
        },
        getGeneration: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalled = true;
        return { ok: true, generationResult: falResult };
      },
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'fal_result');
  assert.equal(falCalled, true);
  assert.equal(
    queries.some((entry) => /INSERT INTO provider_attempts/.test(entry.sql) && entry.params[2] === 'luma_agents_direct'),
    true
  );
  assert.equal(
    queries.some((entry) => /INSERT INTO provider_attempts/.test(entry.sql) && entry.params[2] === 'fal'),
    true
  );
  assert.equal(
    queries.some((entry) => /UPDATE provider_attempts/.test(entry.sql) && entry.params.includes(true)),
    true
  );
});

test('Luma Agents submission does not fallback or double-submit invalid direct requests', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let falCalled = false;
  let rollbackCalled = false;
  const { params } = baseParams({
    pendingReceipt: {
      paymentMode: 'wallet',
      receiptId: 'receipt_123',
      chargeId: 'charge_123',
      amountCents: 130,
      currency: 'usd',
    },
    walletChargeReserved: true,
    deps: {
      queryFn,
      rollbackPendingPaymentFn: async () => {
        rollbackCalled = true;
      },
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => {
          throw new LumaAgentsError('Invalid request', {
            status: 422,
            body: { detail: 'Invalid aspect_ratio' },
          });
        },
        getGeneration: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalled = true;
        return { ok: true, generationResult: { provider: 'fal', thumbUrl: '/thumb.svg' } };
      },
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(falCalled, false);
  assert.equal(rollbackCalled, true);
  assert.equal(
    queries.some((entry) => /UPDATE app_jobs/.test(entry.sql) && entry.params.includes('refunded_wallet')),
    true
  );
});

test('Luma Agents submission keeps HDR requests off fal fallback', async () => {
  const { queryFn } = createQueryRecorder();
  let falCalled = false;
  const { params } = baseParams({
    advancedDirectOnlyEnabled: false,
    falPayload: {
      ...falPayload,
      loop: false,
      extraInputValues: { hdr: true },
    },
    deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => {
          throw new LumaAgentsError('Transient provider failure', { status: 503 });
        },
        getGeneration: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalled = true;
        return { ok: true, generationResult: { provider: 'fal', thumbUrl: '/thumb.svg' } };
      },
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(falCalled, false);
});

test('Luma Agents submission keeps Ray 3.2 Modify off Fal fallback', async () => {
  const { queryFn } = createQueryRecorder();
  let falCalled = false;
  const { params } = baseParams({
    mode: 'v2v',
    durationSec: 5,
    aspectRatio: null,
    falPayload: {
      ...falPayload,
      mode: 'v2v',
      loop: false,
      videoUrl: 'https://cdn.maxvideoai.com/source.mp4',
    },
    falInputSummary: { hasImage: false, hasVideo: true, imageCount: 0, videoCount: 1 },
    deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => {
          throw new LumaAgentsError('Rate limit exceeded', { status: 429 });
        },
        getGeneration: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalled = true;
        return { ok: true, generationResult: { provider: 'fal', thumbUrl: '/thumb.svg' } };
      },
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(falCalled, false);
});

test('Luma Agents submission does not route HDR requests with fal-only options to fal', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let directCalled = false;
  let falCalled = false;
  const { params } = baseParams({
    aspectRatio: '3:1',
    advancedDirectOnlyEnabled: false,
    falPayload: {
      ...falPayload,
      aspectRatio: '3:1',
      loop: false,
      extraInputValues: { hdr: true },
    },
    deps: {
      queryFn,
      getLumaAgentsClientFn: () => ({
        createGeneration: async () => {
          directCalled = true;
          return acceptedTask();
        },
        getGeneration: async () => acceptedTask(),
      }),
      submitFalGenerateTaskFn: async () => {
        falCalled = true;
        return { ok: true, generationResult: { provider: 'fal', thumbUrl: '/thumb.svg' } };
      },
    },
  });

  const result = await submitLumaAgentsGenerateTask(params);

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(falCalled, false);
  assert.equal(directCalled, false);
  assert.equal(
    queries.some((entry) => /INSERT INTO provider_attempts/.test(entry.sql) && entry.params[2] === 'luma_agents_direct'),
    true
  );
  assert.equal(
    queries.some((entry) => /INSERT INTO provider_attempts/.test(entry.sql) && entry.params[2] === 'fal'),
    false
  );
});
