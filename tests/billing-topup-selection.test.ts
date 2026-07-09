import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialTopupSelection } from '../frontend/app/(core)/billing/_lib/billing-selection';

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

test('invalid billing hydration falls back to the first tier', () => {
  for (const value of [undefined, Number.NaN, 999, 10.5]) {
    assert.deepEqual(createInitialTopupSelection(value), {
      selectedTopupCents: 1000,
      customAmountInput: '',
    });
  }
});
