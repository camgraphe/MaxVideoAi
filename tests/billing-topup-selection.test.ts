import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialTopupSelection } from '../frontend/app/(core)/billing/_lib/billing-selection';
import { parseAmountToCents } from '../frontend/app/(core)/billing/_lib/billing-utils';

test('preset billing hydration selects the tier without opening custom state', () => {
  assert.deepEqual(createInitialTopupSelection(2500), {
    selectedTopupCents: 2500,
    customAmountInput: '',
  });
});

test('custom billing hydration preserves the exact dollar input', () => {
  assert.deepEqual(createInitialTopupSelection(1234), {
    selectedTopupCents: 1234,
    customAmountInput: '12.34',
  });
});

test('large safe-integer billing hydration preserves exact cents in the display input', () => {
  assert.deepEqual(createInitialTopupSelection(9007199254740990), {
    selectedTopupCents: 9007199254740990,
    customAmountInput: '90071992547409.90',
  });
});

test('large safe-integer billing hydration round-trips through the custom input parser', () => {
  const initialSelection = createInitialTopupSelection(9007199254740990);
  const reparsedCents = parseAmountToCents(initialSelection.customAmountInput);

  assert.equal(reparsedCents, 9007199254740990);
  assert.deepEqual(createInitialTopupSelection(reparsedCents ?? undefined), initialSelection);
});

test('invalid billing hydration falls back to the first tier', () => {
  for (const value of [undefined, Number.NaN, 999, 10.5]) {
    assert.deepEqual(createInitialTopupSelection(value), {
      selectedTopupCents: 1000,
      customAmountInput: '',
    });
  }
});
