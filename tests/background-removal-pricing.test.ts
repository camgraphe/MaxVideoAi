import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackgroundRemovalPricingPreview,
  estimateBackgroundRemovalCostUsd,
  validateBackgroundRemovalDuration,
} from '../frontend/src/lib/tools-background-removal.ts';

test('background removal dynamic pricing charges double the provider rate', () => {
  assert.equal(estimateBackgroundRemovalCostUsd(10), 0.085);
  assert.equal(estimateBackgroundRemovalCostUsd(10.1), 0.0935);

  const preview = buildBackgroundRemovalPricingPreview({
    unitPriceCents: 5,
    currency: 'usd',
    durationSec: 10,
  });
  assert.equal(preview.ready, true);
  assert.equal(preview.currency, 'USD');
  assert.equal(preview.totalCents, 9);
  assert.equal(preview.estimate?.durationSec, 10);
});

test('background removal duration validation blocks missing and oversized videos', () => {
  assert.match(validateBackgroundRemovalDuration(null) ?? '', /metadata is required/);
  assert.equal(validateBackgroundRemovalDuration(30), null);
  assert.match(validateBackgroundRemovalDuration(61) ?? '', /up to 60 seconds/);
});
