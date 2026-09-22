import assert from 'node:assert/strict';
import test from 'node:test';
import { needsTransactionReview } from '../frontend/lib/admin/transaction-review';
import type { AdminTransactionRecord } from '../frontend/server/admin-transactions/types';
const row = { type: 'charge', amountCents: 150, canRefund: true, jobId: 'job', jobStatus: 'completed' } as AdminTransactionRecord;
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
