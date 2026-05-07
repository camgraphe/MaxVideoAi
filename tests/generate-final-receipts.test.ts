import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  persistFinalChargeReceipt,
  persistWalletFailureRefundReceipt,
} from '../frontend/app/api/generate/_lib/final-receipts';
import type { PendingReceipt } from '../frontend/app/api/generate/_lib/initial-video-job';

const root = process.cwd();
const routePath = join(root, 'frontend/app/api/generate/route.ts');
const helperPath = join(root, 'frontend/app/api/generate/_lib/final-receipts.ts');

const routeSource = readFileSync(routePath, 'utf8');
const helperSource = readFileSync(helperPath, 'utf8');

const pendingReceipt: PendingReceipt = {
  userId: 'user_123',
  amountCents: 1200,
  currency: 'USD',
  description: 'Run Seedance - 8s',
  jobId: 'job_123',
  snapshot: { totalCents: 1200 },
  applicationFeeCents: 300,
  vendorAccountId: 'acct_123',
  stripePaymentIntentId: 'pi_123',
  stripeChargeId: 'ch_123',
};

test('generate route delegates final receipt persistence', () => {
  assert.ok(existsSync(helperPath), 'final receipt persistence should live in the generate route _lib folder');
  assert.match(routeSource, /from '\.\/_lib\/final-receipts'/);
  assert.doesNotMatch(routeSource, /INSERT INTO app_receipts \(user_id, type, amount_cents/, 'final receipt SQL belongs in final-receipts.ts');
  assert.doesNotMatch(routeSource, /UPDATE app_jobs SET payment_status = 'refunded_wallet'/, 'wallet refund status update belongs in final-receipts.ts');

  const lineCount = routeSource.split('\n').length;
  assert.ok(lineCount <= 1940, `/api/generate route should stay below 1940 lines after final receipt extraction, got ${lineCount}`);
});

test('final receipts helper exposes the route contract', () => {
  assert.match(helperSource, /export async function persistFinalChargeReceipt/, 'persistFinalChargeReceipt should be exported');
  assert.match(helperSource, /export async function persistWalletFailureRefundReceipt/, 'persistWalletFailureRefundReceipt should be exported');
  assert.match(helperSource, /ON CONFLICT DO NOTHING/, 'wallet refund insert should stay idempotent');
});

test('final charge receipt helper skips wallet-reserved receipts', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await persistFinalChargeReceipt({
    pendingReceipt,
    walletChargeReserved: true,
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  assert.deepEqual(queries, []);
});

test('final charge receipt helper inserts non-wallet-reserved charges', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await persistFinalChargeReceipt({
    pendingReceipt,
    walletChargeReserved: false,
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  assert.equal(queries.length, 1);
  assert.match(queries[0]?.sql ?? '', /INSERT INTO app_receipts/);
  assert.deepEqual(queries[0]?.params, [
    'user_123',
    1200,
    'USD',
    'Run Seedance - 8s',
    'job_123',
    'video',
    null,
    '{"totalCents":1200}',
    300,
    'acct_123',
    'pi_123',
    'ch_123',
    300,
    'acct_123',
  ]);
});

test('wallet failure refund helper records refund and marks the job refunded', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await persistWalletFailureRefundReceipt({
    status: 'failed',
    pendingReceipt,
    paymentMode: 'wallet',
    engineLabel: 'Seedance',
    durationSec: 8,
    priceOnlyReceipts: false,
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  assert.equal(queries.length, 2);
  assert.match(queries[0]?.sql ?? '', /INSERT INTO app_receipts/);
  assert.deepEqual(queries[0]?.params, [
    'user_123',
    1200,
    'USD',
    'Refund Seedance - 8s',
    'job_123',
    'video',
    null,
    '{"totalCents":1200}',
    0,
    'acct_123',
    'pi_123',
    'ch_123',
    0,
    'acct_123',
  ]);
  assert.match(queries[1]?.sql ?? '', /UPDATE app_jobs SET payment_status = 'refunded_wallet'/);
  assert.deepEqual(queries[1]?.params, ['job_123']);
});

test('wallet failure refund helper honors price-only receipts and skips non-wallet states', async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  await persistWalletFailureRefundReceipt({
    status: 'completed',
    pendingReceipt,
    paymentMode: 'wallet',
    engineLabel: 'Seedance',
    durationSec: 8,
    priceOnlyReceipts: true,
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });
  assert.deepEqual(queries, []);

  await persistWalletFailureRefundReceipt({
    status: 'failed',
    pendingReceipt,
    paymentMode: 'wallet',
    engineLabel: 'Seedance',
    durationSec: 8,
    priceOnlyReceipts: true,
    queryFn: async (sql, params) => {
      queries.push({ sql, params });
    },
  });

  assert.equal(queries.length, 2);
  assert.equal(queries[0]?.params?.[8], null);
  assert.equal(queries[0]?.params?.[9], null);
  assert.equal(queries[0]?.params?.[12], null);
  assert.equal(queries[0]?.params?.[13], null);
});
