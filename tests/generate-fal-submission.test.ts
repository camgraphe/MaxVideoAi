import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  markJobAwaitingFal,
  submitFalGenerateTask,
} from '../frontend/app/api/generate/_lib/fal-submission';
import { FalTimeoutError } from '../frontend/app/api/generate/_lib/fal-error-handling';
import type { GeneratePayload, GenerateResult } from '../frontend/src/lib/fal';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/fal-submission.ts');
const providerSubmissionPath = join(root, 'frontend/app/api/generate/_lib/video-provider-submission.ts');
const routeSource = readFileSync(routePath, 'utf8');
const providerSubmissionSource = readFileSync(providerSubmissionPath, 'utf8');

test('generate route delegates Fal submission and transient error handling', () => {
  assert.ok(existsSync(helperPath), 'Fal submission should live in the generate route _lib folder');
  assert.ok(existsSync(providerSubmissionPath), 'provider submission routing should live in a route-local helper');
  assert.match(routeSource, /from '\.\/_lib\/video-provider-submission'/);
  assert.match(routeSource, /submitGenerateProviderTask/);
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
  assert.equal(queries[0].params?.[2], 'still processing');
  assert.match(queries[1].sql, /INSERT INTO fal_queue_log/);
  assert.deepEqual(queries[1].params?.slice(0, 5), ['job_123', 'fal', 'fal_123', 'seedance-2-0', 'deferred']);
});

test('submitFalGenerateTask returns generation results and persists request ids', async () => {
  const payload: GeneratePayload = { engineId: 'seedance-2-0', prompt: 'test', mode: 't2v' };
  const persisted: string[] = [];
  const result = await withMutedFalLogs(() => submitFalGenerateTask({
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
