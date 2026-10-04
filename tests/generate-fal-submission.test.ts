import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  markJobAwaitingFal,
  submitFalGenerateTask,
} from '../frontend/app/api/generate/_lib/fal-submission';
import { FalTimeoutError } from '../frontend/app/api/generate/_lib/fal-error-handling';
import { persistRefundReceipt } from '../frontend/app/api/generate/_lib/payment-rollback';
import type { PendingReceipt } from '../frontend/app/api/generate/_lib/initial-video-job';
import { FalGenerationError } from '../frontend/src/lib/fal-error';
import type { GeneratePayload, GenerateResult } from '../frontend/src/lib/fal';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/fal-submission.ts');
const providerSubmissionPath = join(root, 'frontend/app/api/generate/_lib/video-provider-submission.ts');
const routeSource = readFileSync(routePath, 'utf8');
const adapterSource = readFileSync(join(root, 'frontend/app/api/generate/_lib/video-generation-adapters.ts'), 'utf8');
const providerSubmissionSource = readFileSync(providerSubmissionPath, 'utf8');

test('generate route delegates Fal submission and transient error handling', () => {
  assert.ok(existsSync(helperPath), 'Fal submission should live in the generate route _lib folder');
  assert.ok(existsSync(providerSubmissionPath), 'provider submission routing should live in a route-local helper');
  assert.match(adapterSource, /from '\.\/video-provider-submission'/);
  assert.match(adapterSource, /submitGenerateProviderTask/);
  assert.match(providerSubmissionSource, /from '\.\/fal-submission'/);
  assert.match(providerSubmissionSource, /const falSubmission = await submitFalGenerateTask/);
  assert.doesNotMatch(routeSource, /generateVideo\(/);
  assert.doesNotMatch(routeSource, /shouldDeferFalError/);
  assert.doesNotMatch(routeSource, /FAL_RETRY_DELAYS_MS/);
  assert.doesNotMatch(routeSource, /function markJobAwaitingFal/);

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 845, `/api/generate route should stay below 845 lines after Fal submission extraction, got ${lineCount}`);
});

test('Fal submission helper exposes the route contract', () => {
  const helperSource = readFileSync(helperPath, 'utf8');

  assert.match(helperSource, /export async function markJobAwaitingFal/);
  assert.match(helperSource, /export async function submitFalGenerateTask/);
  assert.match(helperSource, /FAL_RETRY_DELAYS_MS/);
  assert.match(helperSource, /translateError/);
  assert.match(helperSource, /rollbackPendingPayment/);
});

test('markJobAwaitingFal updates the running job and records provider queue context', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await markJobAwaitingFal({
    jobId: 'job_123',
    engineId: 'seedance-2-0',
    providerJobId: 'fal_123',
    message: ' still\nprocessing ',
    statusLabel: 'deferred',
    attempt: 4,
    context: { deferred: true },
    deps: {
      queryFn: async (sql, params) => {
        queries.push({ sql, params });
        return [];
      },
    },
  });

  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /UPDATE app_jobs/);
  assert.match(
    queries[0].sql,
    /COALESCE\(\$3::text, message\)/,
    'nullable timeout messages must be explicitly typed for PostgreSQL'
  );
  assert.equal(queries[0].params?.[2], 'still processing');
  assert.match(queries[1].sql, /INSERT INTO fal_queue_log/);
  assert.deepEqual(queries[1].params?.slice(0, 5), ['job_123', 'fal', 'fal_123', 'seedance-2-0', 'deferred']);
});

test('submitFalGenerateTask returns generation results and persists request ids', async () => {
  const payload: GeneratePayload = { engineId: 'seedance-2-0', prompt: 'test', mode: 't2v' };
  const persisted: string[] = [];
  const result = await withMutedFalLogs(() => submitFalGenerateTask({
    userId: 'owner',
    falPayload: payload,
    jobId: 'job_123',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    isLumaRay2: false,
    batchId: null,
    durationSec: 5,
    pendingReceipt: null,
    paymentMode: 'platform',
    walletChargeReserved: false,
    getLastProviderJobId: () => null,
    setLastProviderJobId: () => undefined,
    persistProviderJobId: async (providerJobId) => {
      await new Promise<void>((resolve) => setImmediate(resolve));
      persisted.push(providerJobId);
    },
    logMetricFn: () => undefined,
    deps: {
      generateVideoFn: async (_payload, hooks) => {
        await hooks?.onRequestId?.('fal_request_123');
        return {
          provider: 'fal',
          thumbUrl: '/thumb.svg',
          providerJobId: 'fal_request_123',
          status: 'running',
          progress: 10,
        } as GenerateResult;
      },
      withFalTimeoutFn: async (promise) => promise,
    },
  }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.generationResult.providerJobId, 'fal_request_123');
  assert.deepEqual(persisted, ['fal_request_123']);
});

test('submitFalGenerateTask defers timeout responses without refunding pending payments', async () => {
  const updates: Array<{ sql: string; params?: unknown[] }> = [];
  let rolledBack = false;
  const result = await withMutedFalLogs(() => submitFalGenerateTask({
    userId: 'owner',
    falPayload: { engineId: 'seedance-2-0', prompt: 'test', mode: 't2v' },
    jobId: 'job_123',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    isLumaRay2: false,
    batchId: null,
    durationSec: 5,
    pendingReceipt: { jobId: 'job_123' } as never,
    paymentMode: 'direct',
    walletChargeReserved: false,
    getLastProviderJobId: () => null,
    setLastProviderJobId: () => undefined,
    persistProviderJobId: async () => undefined,
    logMetricFn: () => undefined,
    deps: {
      generateVideoFn: async () => {
        throw new FalTimeoutError('timeout');
      },
      withFalTimeoutFn: async (promise) => promise,
      queryFn: async (sql, params) => {
        updates.push({ sql, params });
        return [];
      },
      rollbackPendingPaymentFn: async () => {
        rolledBack = true;
      },
    },
  }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 202);
  assert.equal(result.body.deferred, true);
  assert.equal(result.body.status, 'running');
  assert.equal(rolledBack, false);
  assert.match(updates[0].sql, /UPDATE app_jobs/);
});

test('submitFalGenerateTask defers before the Vercel runtime deadline', async () => {
  let timeoutBudgetMs: number | null = null;

  const result = await withMutedFalLogs(() => submitFalGenerateTask({
    userId: 'owner',
    falPayload: { engineId: 'seedance-2-0', prompt: 'test', mode: 't2v' },
    jobId: 'job_vercel_budget',
    engineId: 'seedance-2-0',
    engineLabel: 'Seedance 2.0',
    isLumaRay2: false,
    batchId: null,
    durationSec: 5,
    pendingReceipt: null,
    paymentMode: 'platform',
    walletChargeReserved: false,
    getLastProviderJobId: () => 'fal_request_budget',
    setLastProviderJobId: () => undefined,
    persistProviderJobId: async () => undefined,
    logMetricFn: () => undefined,
    deps: {
      generateVideoFn: async () => new Promise<GenerateResult>(() => undefined),
      withFalTimeoutFn: async (_promise, timeoutMs) => {
        timeoutBudgetMs = timeoutMs;
        throw new FalTimeoutError('timeout');
      },
      queryFn: async () => [],
    },
  }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 202);
  assert.equal(result.body.deferred, true);
  assert.ok(timeoutBudgetMs !== null && timeoutBudgetMs <= 240_000, `expected at least 60s of Vercel headroom, got ${timeoutBudgetMs}ms`);
});

for (const { status, message } of [
  { status: 400, message: 'Invalid input' },
  { status: 401, message: 'Unauthorized' },
  { status: 402, message: 'Insufficient credits' },
  { status: 403, message: 'User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing.' },
  { status: 422, message: 'Content flagged by a content checker' },
  { status: 429, message: 'Quota exceeded' },
]) {
  test(`enqueue rejection ${status} refunds the charge instead of polling a local batch id`, async () => {
    const { result, queries } = await submitRejectedEnqueue(new FalGenerationError(
      'Generation submission could not be confirmed.',
      { status, body: { detail: message } }
    ));

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, status);
    assert.notEqual(result.body.deferred, true);
    const jobUpdate = queries.find(({ sql }) => sql.includes('UPDATE app_jobs'));
    assert.match(jobUpdate?.sql ?? '', /SET status = 'failed'/);
    assert.equal(jobUpdate?.params?.[2], null, 'a local batch is not a Fal request id');
    assert.equal(jobUpdate?.params?.[3], 'refunded_wallet');
    assertExactWalletRefund(queries);
  });
}

for (const status of [403, 422]) {
  test(`a definitive ${status} error with a Fal request id still follows the refund policy`, async () => {
    const { result, queries } = await submitRejectedEnqueue(new FalGenerationError(
      'Render request failed',
      {
        status,
        body: { detail: status === 403 ? 'User is locked. Reason: Exhausted balance.' : 'Content flagged by a content checker' },
        providerJobId: 'fal_request_terminal',
      }
    ));

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, status);
    assert.notEqual(result.body.deferred, true);
    assertExactWalletRefund(queries);
  });
}

for (const error of [
  new FalGenerationError('Connection lost'),
  new FalGenerationError('Service temporarily unavailable', { status: 503 }),
  new FalGenerationError('Request timed out', { status: 408 }),
  new FalTimeoutError('timeout'),
]) {
  test(`uncertain enqueue ${error.name}/${'status' in error ? error.status ?? 'network' : 'timeout'} stays pending without a synthetic Fal id`, async () => {
    const { result, queries } = await submitRejectedEnqueue(error);

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(result.body.deferred, true);
    assert.equal(result.body.providerJobId, null);
    assert.equal(queries.some(({ sql }) => sql.includes('INSERT INTO app_receipts')), false);
    assert.equal(queries.some(({ sql }) => sql.includes('INSERT INTO fal_queue_log')), false);
  });
}

for (const status of [404, 503]) {
  test(`an accepted Fal request survives a transient ${status} error without a refund`, async () => {
    const { result, queries } = await submitRejectedEnqueue(new FalGenerationError(
      'Render status temporarily unavailable',
      { status, providerJobId: 'fal_request_accepted' }
    ));

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 202);
    assert.equal(result.body.deferred, true);
    assert.equal(result.body.providerJobId, 'fal_request_accepted');
    assert.equal(queries.some(({ sql }) => sql.includes('INSERT INTO app_receipts')), false);
    const jobUpdate = queries.find(({ sql }) => sql.includes('UPDATE app_jobs'));
    assert.equal(jobUpdate?.params?.[3], 'fal_request_accepted');
  });
}

type CapturedQuery = { sql: string; params?: unknown[] };

async function submitRejectedEnqueue(error: Error) {
  const queries: CapturedQuery[] = [];
  const pendingReceipt: PendingReceipt = {
    userId: 'user_enqueue',
    jobId: 'job_enqueue',
    amountCents: 98,
    currency: 'USD',
    description: 'Run MiniMax H3 Max - 15s',
    snapshot: { totalCents: 98 },
    applicationFeeCents: 23,
    vendorAccountId: null,
  };
  const queryFn = async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
    queries.push({ sql, params });
    return [];
  };
  const result = await withMutedFalLogs(() => submitFalGenerateTask({
    falPayload: { engineId: 'minimax-h3-max', prompt: 'test', mode: 't2v', submissionMode: 'enqueue' },
    jobId: 'job_enqueue',
    engineId: 'minimax-h3-max',
    engineLabel: 'MiniMax H3 Max',
    isLumaRay2: false,
    batchId: 'batch_local_123',
    durationSec: 15,
    pendingReceipt,
    paymentMode: 'wallet',
    walletChargeReserved: true,
    getLastProviderJobId: () => null,
    setLastProviderJobId: () => undefined,
    persistProviderJobId: async () => undefined,
    logMetricFn: () => undefined,
    deps: {
      generateVideoFn: async () => { throw error; },
      withFalTimeoutFn: async (promise) => promise,
      queryFn,
      rollbackPendingPaymentFn: async ({ pendingReceipt: receipt, refundDescription }) => {
        assert.ok(receipt);
        await persistRefundReceipt({ receipt, description: refundDescription, stripeRefundId: null, priceOnly: true, queryFn });
      },
    },
  }));
  return { result, queries };
}

function assertExactWalletRefund(queries: CapturedQuery[]) {
  const refunds = queries.filter(({ sql }) => sql.includes('INSERT INTO app_receipts'));
  assert.equal(refunds.length, 1);
  assert.match(refunds[0].sql, /'refund'/);
  assert.match(refunds[0].sql, /ON CONFLICT DO NOTHING/);
  assert.deepEqual(refunds[0].params?.slice(0, 3), ['user_enqueue', 98, 'USD']);
  assert.equal(refunds[0].params?.[4], 'job_enqueue');
}

async function withMutedFalLogs<T>(fn: () => Promise<T>): Promise<T> {
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = () => undefined;
  console.error = () => undefined;
  try {
    return await fn();
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }
}
