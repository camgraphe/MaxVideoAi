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
import {
  issueManualWalletRefund,
  issueManualWalletRefundByReceipt,
  type AdminRefundDependencies,
} from '../frontend/server/admin-transactions/refunds.ts';
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

type SqlCall = { text: string; params?: ReadonlyArray<unknown> };

function refundHarness(responses: Array<unknown[] | Error>) {
  const calls: SqlCall[] = [];
  let transactions = 0;
  let rollbacks = 0;
  const executor: QueryExecutor = {
    query: async <TRecord>(text: string, params?: ReadonlyArray<unknown>) => {
      calls.push({ text, params });
      const response = responses.shift() ?? [];
      if (response instanceof Error) throw response;
      return response as TRecord[];
    },
  };
  const dependencies: AdminRefundDependencies = {
    databaseConfigured: () => true,
    ensureSchema: async () => undefined,
    withTransaction: async (callback) => {
      transactions += 1;
      try {
        return await callback(executor);
      } catch (error) {
        rollbacks += 1;
        throw error;
      }
    },
    now: () => 'fallback-time',
  };
  return {
    calls,
    dependencies,
    transactionCount: () => transactions,
    rollbackCount: () => rollbacks,
  };
}

test('job refund locks the latest charge and performs every write in one transaction', async () => {
  const harness = refundHarness([
    [{ job_id: 'job_1', user_id: 'user_1', payment_status: 'paid_wallet', pricing_snapshot: { total: 900 }, vendor_account_id: 'vendor', message: null, engine_label: 'Veo', duration_sec: 8, currency: 'usd' }],
    [{ id: 10, amount_cents: '900', currency: 'usd', description: 'Generation' }],
    [],
    [],
    [{ id: 20, created_at: '2026-07-14T12:00:00.000Z' }],
    [],
  ]);

  const result = await issueManualWalletRefund(
    { jobId: ' job_1 ', adminUserId: 'admin_1', adminEmail: 'admin@example.com', note: ' support ' },
    harness.dependencies
  );

  assert.deepEqual(result, { refundReceiptId: 20, createdAt: '2026-07-14T12:00:00.000Z' });
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.calls.length, 6);
  assert.match(harness.calls[1]!.text, /FOR UPDATE/);
  assert.match(harness.calls[2]!.text, /pg_advisory_xact_lock/);
  assert.match(harness.calls[3]!.text, /type = 'refund'/);
  assert.match(harness.calls[4]!.text, /INSERT INTO app_receipts/);
  assert.match(harness.calls[5]!.text, /UPDATE app_jobs/);
  const metadata = JSON.parse(String(harness.calls[4]!.params?.[7]));
  assert.deepEqual(metadata, {
    reason: 'manual_admin_refund',
    admin_user_id: 'admin_1',
    admin_email: 'admin@example.com',
    original_receipt_id: 10,
    note: 'support',
  });
});

test('receipt refund preserves orphan-charge fallback and skips job update', async () => {
  const harness = refundHarness([
    [{ id: 30, user_id: 'user_2', job_id: null, amount_cents: 500, currency: null, description: null, vendor_account_id: null, pricing_snapshot: null }],
    [],
    [{ id: 31, created_at: '2026-07-14T13:00:00.000Z' }],
  ]);

  const result = await issueManualWalletRefundByReceipt(
    { receiptId: 30, adminUserId: 'admin_1' },
    harness.dependencies
  );

  assert.deepEqual(result, { refundReceiptId: 31, createdAt: '2026-07-14T13:00:00.000Z' });
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.calls.length, 3);
  assert.match(harness.calls[0]!.text, /FOR UPDATE/);
  assert.match(harness.calls[2]!.text, /INSERT INTO app_receipts/);
  assert.equal(harness.calls.some((call) => /UPDATE app_jobs/.test(call.text)), false);
  assert.equal(harness.calls[2]!.params?.[3], 'Manual refund for receipt 30');
});

test('duplicate refund is rejected after the charge lock and before insert', async () => {
  const harness = refundHarness([
    [{ job_id: 'job_1', user_id: 'user_1', payment_status: 'paid_wallet', pricing_snapshot: null, vendor_account_id: null, message: null, engine_label: null, duration_sec: null, currency: 'USD' }],
    [{ id: 10, amount_cents: 900, currency: 'USD', description: null }],
    [],
    [{ id: 99 }],
  ]);

  await assert.rejects(
    issueManualWalletRefund({ jobId: 'job_1', adminUserId: 'admin_1' }, harness.dependencies),
    /Job or wallet charge not found, or refund already issued\./
  );
  assert.match(harness.calls[1]!.text, /FOR UPDATE/);
  assert.match(harness.calls[2]!.text, /pg_advisory_xact_lock/);
  assert.match(harness.calls[3]!.text, /type = 'refund'/);
  assert.equal(harness.calls.some((call) => /INSERT INTO app_receipts/.test(call.text)), false);
});

test('receipt selector preserves null-status acceptance and non-wallet rejection', async () => {
  const nullable = refundHarness([
    [{ id: 40, user_id: 'user', job_id: 'job', amount_cents: 100, currency: 'USD', description: null, vendor_account_id: null, pricing_snapshot: null }],
    [],
    [],
    [{ payment_status: null }],
    [{ id: 41, created_at: 'created' }],
    [],
  ]);
  await issueManualWalletRefundByReceipt(
    { receiptId: 40, adminUserId: 'admin' },
    nullable.dependencies
  );

  const nonWallet = refundHarness([
    [{ id: 40, user_id: 'user', job_id: 'job', amount_cents: 100, currency: 'USD', description: null, vendor_account_id: null, pricing_snapshot: null }],
    [],
    [],
    [{ payment_status: 'paid_stripe' }],
  ]);
  await assert.rejects(
    issueManualWalletRefundByReceipt(
      { receiptId: 40, adminUserId: 'admin' },
      nonWallet.dependencies
    ),
    /This charge is not a wallet payment or has already been refunded\./
  );
});

test('refund write failure propagates through the transaction without updating the job', async () => {
  const harness = refundHarness([
    [{ job_id: 'job_1', user_id: 'user_1', payment_status: 'paid_wallet', pricing_snapshot: null, vendor_account_id: null, message: null, engine_label: null, duration_sec: null, currency: 'USD' }],
    [{ id: 10, amount_cents: 900, currency: 'USD', description: null }],
    [],
    [],
    new Error('insert failed'),
  ]);

  await assert.rejects(
    issueManualWalletRefund({ jobId: 'job_1', adminUserId: 'admin_1' }, harness.dependencies),
    /insert failed/
  );
  assert.equal(harness.transactionCount(), 1);
  assert.equal(harness.rollbackCount(), 1);
  assert.equal(harness.calls.some((call) => /UPDATE app_jobs/.test(call.text)), false);
});

test('job and receipt selectors serialize the same job before duplicate validation', async () => {
  const jobHarness = refundHarness([
    [{ job_id: 'job_shared', user_id: 'user', payment_status: 'paid_wallet', pricing_snapshot: null, vendor_account_id: null, message: null, engine_label: null, duration_sec: null, currency: 'USD' }],
    [{ id: 50, amount_cents: 100, currency: 'USD', description: null }],
    [],
    [],
    [{ id: 51, created_at: 'job-refund' }],
    [],
  ]);
  await issueManualWalletRefund(
    { jobId: 'job_shared', adminUserId: 'admin' },
    jobHarness.dependencies
  );

  const receiptHarness = refundHarness([
    [{ id: 49, user_id: 'user', job_id: 'job_shared', amount_cents: 100, currency: 'USD', description: null, vendor_account_id: null, pricing_snapshot: null }],
    [],
    [],
    [],
    [{ id: 52, created_at: 'receipt-refund' }],
  ]);
  await issueManualWalletRefundByReceipt(
    { receiptId: 49, adminUserId: 'admin' },
    receiptHarness.dependencies
  );

  const jobLockIndex = jobHarness.calls.findIndex((call) => /pg_advisory_xact_lock/.test(call.text));
  const jobDuplicateIndex = jobHarness.calls.findIndex((call) => /type = 'refund'/.test(call.text));
  const receiptLockIndex = receiptHarness.calls.findIndex((call) => /pg_advisory_xact_lock/.test(call.text));
  const receiptDuplicateIndex = receiptHarness.calls.findIndex((call) => /type = 'refund'/.test(call.text));

  assert.equal(jobLockIndex, 2);
  assert.equal(receiptLockIndex, 1);
  assert.deepEqual(jobHarness.calls[jobLockIndex]?.params, ['job_shared']);
  assert.deepEqual(receiptHarness.calls[receiptLockIndex]?.params, ['job_shared']);
  assert.ok(jobLockIndex < jobDuplicateIndex);
  assert.ok(receiptLockIndex < receiptDuplicateIndex);
  assert.match(receiptHarness.calls[3]!.text, /FROM app_jobs/);
  assert.equal(receiptHarness.calls.some((call) => /UPDATE app_jobs/.test(call.text)), false);
});
