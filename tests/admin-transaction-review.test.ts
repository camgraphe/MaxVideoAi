import assert from 'node:assert/strict';
import test from 'node:test';
import { needsTransactionReview, isMissingJobRecord } from '../frontend/lib/admin/transaction-review';
import type { AdminTransactionRecord } from '../frontend/server/admin-transactions/types';
const row = {
  type: 'charge',
  amountCents: 150,
  canRefund: true,
  jobId: 'job',
  jobStatus: 'completed',
} as AdminTransactionRecord;
test('a valid refundable charge does not require review', () => assert.equal(needsTransactionReview(row), false));
test('missing jobs and nonpositive charges require review', () => {
  assert.equal(needsTransactionReview({ ...row, jobStatus: null }), true);
  assert.equal(needsTransactionReview({ ...row, amountCents: 0 }), true);
  assert.equal(needsTransactionReview({ ...row, amountCents: -10 }), true);
});
test('refunds and wallet-only credits do not imply a missing job', () => {
  assert.equal(needsTransactionReview({ ...row, type: 'refund', jobId: null }), false);
  assert.equal(needsTransactionReview({ ...row, type: 'topup', jobId: null }), false);
});


test('Milo packs use product identity or the exact historical prefix instead of media presence', () => {
  for (const identity of [
    { billingProductKey: 'studio_assistance_pack', jobId: 'product-receipt-reference' },
    { billingProductKey: 'studio_assistance_pack', jobId: null },
    { billingProductKey: null, jobId: 'studio-sol-pack:synthetic-pack' },
  ]) {
    const pack = { ...row, jobStatus: null, ...identity };
    assert.equal(isMissingJobRecord(pack), false, JSON.stringify(identity));
    assert.equal(needsTransactionReview(pack), false, JSON.stringify(identity));
    assert.equal(needsTransactionReview({ ...pack, amountCents: 0 }), true);
    assert.equal(needsTransactionReview({ ...pack, amountCents: -1 }), true);
  }
});
test('null products, descriptions and lookalike prefixes retain real missing-media review', () => {
  for (const jobId of ['missing-media', 'studio-sol-pack-lookalike', 'studio-sol-pack', 'Studio-sol-pack:other']) {
    assert.equal(needsTransactionReview({
      ...row, jobStatus: null, jobId, billingProductKey: null, description: 'Milo credit pack',
    } as AdminTransactionRecord), true, jobId);
  }
});
