import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackgroundRemovalPricingPreview,
  estimateBackgroundRemovalCostUsd,
  validateBackgroundRemovalDuration,
} from '../frontend/src/lib/tools-background-removal.ts';

test('background removal dynamic pricing applies the configured price rule', () => {
  assert.equal(estimateBackgroundRemovalCostUsd(10), 0.085);
  assert.equal(estimateBackgroundRemovalCostUsd(10.1), 0.0935);
  assert.equal(estimateBackgroundRemovalCostUsd(60, 'mov_proresks'), 0.51);

  const preview = buildBackgroundRemovalPricingPreview({
    unitPriceCents: 5,
    currency: 'usd',
    durationSec: 10,
  });
  assert.equal(preview.ready, true);
  assert.equal(preview.currency, 'USD');
  assert.equal(preview.totalCents, 9);
  assert.equal(preview.estimate?.durationSec, 10);
  assert.equal(preview.estimate?.estimatedCostUsd, 0.085);

  const staleProResPreview = buildBackgroundRemovalPricingPreview({
    unitPriceCents: 5,
    currency: 'usd',
    durationSec: 60,
    outputCodec: 'mov_proresks',
  });
  assert.equal(staleProResPreview.ready, true);
  assert.equal(staleProResPreview.totalCents, 51);
  assert.equal(staleProResPreview.estimate?.estimatedCostUsd, 0.51);
  assert.equal(staleProResPreview.estimate?.priceMultiplier, 2);
});

test('background removal duration validation blocks missing and oversized videos', () => {
  assert.match(validateBackgroundRemovalDuration(null) ?? '', /metadata is required/);
  assert.equal(validateBackgroundRemovalDuration(30), null);
  assert.match(validateBackgroundRemovalDuration(61) ?? '', /up to 60 seconds/);
});
