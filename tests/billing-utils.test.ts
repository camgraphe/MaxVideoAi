import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAmountToCents } from '../frontend/app/(core)/billing/_lib/billing-utils';

test('billing amount parser preserves exact cents through the safe-integer boundary', () => {
  assert.equal(parseAmountToCents('90071992547409.90'), 9007199254740990);
  assert.equal(parseAmountToCents('90071992547409.91'), Number.MAX_SAFE_INTEGER);
});

test('billing amount parser accepts ordinary dot and comma decimals', () => {
  assert.equal(parseAmountToCents('12.34'), 1234);
  assert.equal(parseAmountToCents(' 12,34 '), 1234);
  assert.equal(parseAmountToCents('.50'), 50);
  assert.equal(parseAmountToCents('12.'), 1200);
});

test('billing amount parser rounds extra fractional digits to the nearest cent', () => {
  assert.equal(parseAmountToCents('1.005'), 101);
  assert.equal(parseAmountToCents('12.344'), 1234);
  assert.equal(parseAmountToCents('12.345'), 1235);
  assert.equal(parseAmountToCents('1.999'), 200);
});

test('billing amount parser rejects invalid, nonpositive, and unsafe results', () => {
  for (const value of ['', ' ', 'not-a-number', '12.3.4', '0', '-1', '0.004', '90071992547409.92']) {
    assert.equal(parseAmountToCents(value), null, value);
  }
});
