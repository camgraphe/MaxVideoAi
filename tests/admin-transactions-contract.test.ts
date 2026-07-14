import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coerceNumber,
  isRefundablePaymentStatus,
  normalizeCurrency,
} from '../frontend/server/admin-transactions/normalizers.ts';
import {
  mapAdminTransactionRow,
  normalizeTransactionLimit,
} from '../frontend/server/admin-transactions/read-model.ts';
import { issueManualWalletTopUp } from '../frontend/server/admin-transactions/topups.ts';
import type { RawTransactionRow } from '../frontend/server/admin-transactions/types.ts';
import type { QueryExecutor } from '../frontend/src/lib/db.ts';

function rawTransaction(overrides: Partial<RawTransactionRow> = {}): RawTransactionRow {
  return {
    receipt_id: 10,
    user_id: 'user_1',
    type: 'charge',
    amount_cents: '900',
    currency: 'usd',
    description: 'Generation',
    job_id: 'job_1',
    created_at: '2026-07-14T10:00:00.000Z',
    job_status: 'completed',
    job_payment_status: 'paid_wallet',
    job_engine_label: 'Veo',
    job_video_url: 'renders/video.mp4',
    job_thumb_url: null,
    job_message: null,
    job_progress: 100,
    job_created_at: '2026-07-14T09:59:00.000Z',
    job_duration_sec: 8,
    has_refund: false,
    latest_charge_id: 10,
    ...overrides,
  };
}

test('admin transaction value helpers preserve legacy database fallbacks', () => {
  assert.equal(coerceNumber(125), 125);
  assert.equal(coerceNumber('250'), 250);
  assert.equal(coerceNumber('not-a-number'), 0);
  assert.equal(coerceNumber(null), 0);
  assert.equal(normalizeCurrency('eur'), 'EUR');
  assert.equal(normalizeCurrency(null), 'USD');
  assert.equal(isRefundablePaymentStatus('paid_wallet'), true);
  assert.equal(isRefundablePaymentStatus('refunded_wallet'), false);
  assert.equal(isRefundablePaymentStatus(null), false);
});

test('ledger mapper preserves latest paid-wallet refund eligibility and DTO shape', () => {
  const record = mapAdminTransactionRow(rawTransaction(), 'member@example.com');
  assert.equal(record.userEmail, 'member@example.com');
  assert.equal(record.amountCents, 900);
  assert.equal(record.currency, 'USD');
  assert.equal(record.jobVideoUrl, '/renders/video.mp4');
  assert.equal(record.isLatestCharge, true);
  assert.equal(record.canRefund, true);
});

test('ledger mapper preserves rejection and historical missing-job behavior', () => {
  assert.equal(mapAdminTransactionRow(rawTransaction({ latest_charge_id: 9 }), null).canRefund, false);
  assert.equal(mapAdminTransactionRow(rawTransaction({ has_refund: true }), null).canRefund, false);
  assert.equal(mapAdminTransactionRow(rawTransaction({ user_id: null }), null).canRefund, false);
  assert.equal(mapAdminTransactionRow(rawTransaction({ job_payment_status: 'paid_stripe' }), null).canRefund, false);

  const missingJob = rawTransaction({
    job_status: null,
    job_payment_status: null,
    job_engine_label: null,
    job_video_url: null,
    job_thumb_url: null,
    latest_charge_id: null,
  });
  assert.equal(mapAdminTransactionRow(missingJob, null).canRefund, true);

  const orphanReceipt = rawTransaction({ job_id: null, latest_charge_id: null });
  assert.equal(mapAdminTransactionRow(orphanReceipt, null).canRefund, true);
});

test('ledger limit remains clamped to the public 1 through 500 range', () => {
  assert.equal(normalizeTransactionLimit(-1), 1);
  assert.equal(normalizeTransactionLimit(100), 100);
  assert.equal(normalizeTransactionLimit(900), 500);
});

test('manual top-up preserves validation, metadata, normalization, and response shape', async () => {
  const calls: Array<{ text: string; params?: ReadonlyArray<unknown> }> = [];
  const executor: QueryExecutor = {
    query: async <TRecord>(text: string, params?: ReadonlyArray<unknown>) => {
      calls.push({ text, params });
      return [{ id: 77, created_at: '2026-07-14T12:00:00.000Z', amount_cents: '1250', currency: 'eur' }] as TRecord[];
    },
  };
  let schemaCalls = 0;

  const result = await issueManualWalletTopUp(
    {
      userId: ' user_1 ',
      amountCents: 1249.7,
      currency: 'eur',
      description: null,
      adminUserId: 'admin_1',
      adminEmail: 'admin@example.com',
      note: ' goodwill ',
    },
    {
      databaseConfigured: () => true,
      ensureSchema: async () => { schemaCalls += 1; },
      executor,
      now: () => 'fallback-time',
    }
  );

  assert.equal(schemaCalls, 1);
  assert.deepEqual(result, {
    receiptId: 77,
    createdAt: '2026-07-14T12:00:00.000Z',
    amountCents: 1250,
    currency: 'EUR',
  });
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.text, /INSERT INTO app_receipts/);
  assert.equal(calls[0]!.params?.[0], 'user_1');
  assert.equal(calls[0]!.params?.[1], 1250);
  assert.equal(calls[0]!.params?.[2], 'EUR');
  assert.match(String(calls[0]!.params?.[3]), /Manual wallet credit issued by admin@example\.com/);
  assert.deepEqual(JSON.parse(String(calls[0]!.params?.[4])), {
    reason: 'manual_admin_topup',
    admin_user_id: 'admin_1',
    admin_email: 'admin@example.com',
    note: 'goodwill',
  });
});

test('manual top-up rejects unavailable database and invalid values before SQL', async () => {
  const executor: QueryExecutor = { query: async () => { throw new Error('must not query'); } };
  const base = {
    ensureSchema: async () => undefined,
    executor,
    now: () => 'fallback-time',
  };
  await assert.rejects(
    issueManualWalletTopUp(
      { userId: 'user', amountCents: 100, adminUserId: 'admin' },
      { ...base, databaseConfigured: () => false }
    ),
    /Database unavailable/
  );
  await assert.rejects(
    issueManualWalletTopUp(
      { userId: ' ', amountCents: 100, adminUserId: 'admin' },
      { ...base, databaseConfigured: () => true }
    ),
    /Missing userId/
  );
  await assert.rejects(
    issueManualWalletTopUp(
      { userId: 'user', amountCents: 0, adminUserId: 'admin' },
      { ...base, databaseConfigured: () => true }
    ),
    /Invalid amountCents/
  );
});
