import assert from 'node:assert/strict';
import test from 'node:test';

import {
  coerceNumber,
  isRefundablePaymentStatus,
  normalizeCurrency,
} from '../frontend/server/admin-transactions/normalizers.ts';

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
