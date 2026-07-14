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
import type { RawTransactionRow } from '../frontend/server/admin-transactions/types.ts';

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
