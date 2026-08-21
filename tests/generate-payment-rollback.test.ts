import assert from 'node:assert/strict';
import test from 'node:test';

import type { PendingReceipt } from '../frontend/app/api/generate/_lib/initial-video-job';

type PersistRefundReceipt = (params: {
  receipt: PendingReceipt;
  description: string;
  stripeRefundId: string | null;
  priceOnly: boolean;
  queryFn: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
}) => Promise<void>;

const receipt: PendingReceipt = {
  userId: 'user_123',
  amountCents: 246,
  currency: 'USD',
  description: 'Kling 3.0 Omni Standard - 15s',
  jobId: 'job_123',
  snapshot: { engineId: 'kling-o3-standard' },
  applicationFeeCents: null,
  vendorAccountId: null,
};

test('generate refund persistence upgrades a webhook 422 description with the precise safety reason', async () => {
  const paymentRollback = await import('../frontend/app/api/generate/_lib/payment-rollback');
  const persistRefundReceipt = (paymentRollback as { persistRefundReceipt?: PersistRefundReceipt })
    .persistRefundReceipt;
  assert.equal(
    typeof persistRefundReceipt,
    'function',
    'payment rollback should expose deterministic refund persistence'
  );

  let storedDescription = 'Refund Kling 3.0 Omni Standard - 15s - Unexpected status code: 422';
  const specificDescription =
    'Refund Kling 3.0 Omni Standard - 15s - Request was blocked by safety checks.';

  await persistRefundReceipt!({
    receipt,
    description: specificDescription,
    stripeRefundId: null,
    priceOnly: true,
    queryFn: async <T>(sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO app_receipts')) return [] as T[];
      if (sql.includes('SELECT id, description FROM app_receipts')) {
        return [{ id: '7590', description: storedDescription }] as T[];
      }
      if (sql.includes('UPDATE app_receipts')) {
        storedDescription = String(params?.[1] ?? '');
        return [] as T[];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });

  assert.equal(storedDescription, specificDescription);
});

test('generate refund persistence never replaces a precise reason with a generic webhook status', async () => {
  const paymentRollback = await import('../frontend/app/api/generate/_lib/payment-rollback');
  const persistRefundReceipt = (paymentRollback as { persistRefundReceipt?: PersistRefundReceipt })
    .persistRefundReceipt;
  assert.equal(typeof persistRefundReceipt, 'function');

  const specificDescription =
    'Refund Kling 3.0 Omni Standard - 15s - Request was blocked by safety checks.';
  let storedDescription = specificDescription;

  await persistRefundReceipt!({
    receipt,
    description: 'Refund Kling 3.0 Omni Standard - 15s - Unexpected status code: 422',
    stripeRefundId: null,
    priceOnly: true,
    queryFn: async <T>(sql: string, params?: unknown[]) => {
      if (sql.includes('INSERT INTO app_receipts')) return [] as T[];
      if (sql.includes('SELECT id, description FROM app_receipts')) {
        return [{ id: '7590', description: storedDescription }] as T[];
      }
      if (sql.includes('UPDATE app_receipts')) {
        storedDescription = String(params?.[1] ?? '');
        return [] as T[];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  });

  assert.equal(storedDescription, specificDescription);
});
