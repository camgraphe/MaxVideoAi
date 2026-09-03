import assert from 'node:assert/strict';
import test from 'node:test';

import type { GenerateResult } from '../frontend/src/lib/fal-types';
import {
  classifyKlingDirectError,
  KlingDirectError,
  shouldFallbackFromKlingDirectSubmit,
} from '../frontend/src/server/video-providers/kling-direct/errors';
import { submitKlingDirectGenerateTask } from '../frontend/app/api/generate/_lib/kling-direct-submission';

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

test('an unfunded Kling direct account falls back to Fal only before acceptance', () => {
  const insufficientBalance = new KlingDirectError('Account balance not enough', {
    status: 429,
    code: '1102',
    body: { code: 1102, message: 'Account balance not enough' },
  });

  assert.equal(classifyKlingDirectError(insufficientBalance).errorClass, 'insufficient_provider_credits');
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: null,
      error: insufficientBalance,
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: true,
    }),
    true
  );
  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: 'accepted_task',
      error: insufficientBalance,
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: true,
    }),
    false
  );
});

test('Kling direct balance fallback stays opt-in and never covers unsafe failures', () => {
  const insufficientBalance = new KlingDirectError('Account balance not enough', {
    status: 429,
    code: '1102',
  });
  const invalidPrompt = new KlingDirectError('Invalid prompt', { status: 400, code: '1201' });
  const moderation = new KlingDirectError('Moderation blocked', { status: 400, code: '1300' });
  const authentication = new KlingDirectError('Invalid credentials', { status: 401, code: '1001' });

  assert.equal(
    shouldFallbackFromKlingDirectSubmit({
      acceptedProviderJobId: null,
      error: insufficientBalance,
      fallbackToFalEnabled: true,
      fallbackOnCreditsDepletedEnabled: false,
    }),
    false
  );
  for (const error of [invalidPrompt, moderation, authentication]) {
    assert.equal(
      shouldFallbackFromKlingDirectSubmit({
        acceptedProviderJobId: null,
        error,
        fallbackToFalEnabled: true,
        fallbackOnCreditsDepletedEnabled: true,
      }),
      false
    );
  }
});

test('Kling 3 Turbo records one rejected direct attempt then one accepted Fal attempt', async () => {
  const { queries, queryFn } = createQueryRecorder();
  let directCalls = 0;
  let falCalls = 0;
  const falResult: GenerateResult = {
    provider: 'fal',
    thumbUrl: '/assets/frames/thumb-16x9.svg',
    providerJobId: 'fal_turbo_123',
    status: 'queued',
    progress: 10,
  };

  const result = await submitKlingDirectGenerateTask({
    jobId: 'job_turbo_fallback',
    userId: 'user_staging',
    engineId: 'kling-3-turbo-standard',
    engineLabel: 'Kling 3.0 Turbo Standard',
    mode: 't2v',
    prompt: 'A cyclist crosses a sunlit plaza.',
    negativePrompt: null,
    durationSec: 3,
    aspectRatio: '16:9',
    audioEnabled: false,
    imageUrl: null,
    cfgScale: null,
    placeholderThumb: '/assets/frames/thumb-16x9.svg',
    pricing: { totalCents: 42, currency: 'usd' },
    paymentStatus: 'paid_wallet',
    pendingReceipt: null,
    paymentMode: 'wallet',
    walletChargeReserved: false,
    fallbackToFalEnabled: true,
    fallbackOnCreditsDepletedEnabled: true,
    elementRegistrationEnabled: false,
    falPayload: {
      engineId: 'kling-3-turbo-standard',
      prompt: 'A cyclist crosses a sunlit plaza.',
      mode: 't2v',
      durationSec: 3,
      durationOption: '3s',
      aspectRatio: '16:9',
      resolution: '720p',
    },
    falInputSummary: { hasImage: false, hasVideo: false, imageCount: 0, videoCount: 0 },
    isLumaRay2: false,
    batchId: null,
    groupId: null,
    iterationIndex: null,
    iterationCount: null,
    renderIds: null,
    heroRenderId: null,
    localKey: null,
    logMetricFn() {},
    deps: {
      queryFn,
      getKlingDirectClientFn: () => ({
        createTask: async () => {
          directCalls += 1;
          throw new KlingDirectError('Account balance not enough', {
            status: 429,
            code: '1102',
            body: { code: 1102, message: 'Account balance not enough' },
          });
        },
      }) as never,
      submitFalGenerateTaskFn: async () => {
        falCalls += 1;
        return { ok: true, generationResult: falResult };
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'fal_result');
  assert.equal(directCalls, 1);
  assert.equal(falCalls, 1);
  assert.deepEqual(
    queries
      .filter((entry) => /INSERT INTO provider_attempts/.test(entry.sql))
      .map((entry) => [entry.params[1], entry.params[2]]),
    [[1, 'kling_direct'], [2, 'fal']]
  );
  assert.equal(
    queries.some((entry) => /fallback_eligible/.test(entry.sql) && entry.params[4] === true),
    true
  );
  assert.equal(
    queries.some((entry) => /fallback_to_attempt_id/.test(entry.sql)),
    true
  );
});
