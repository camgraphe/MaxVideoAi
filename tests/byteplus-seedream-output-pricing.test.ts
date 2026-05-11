import assert from 'node:assert/strict';
import test from 'node:test';

import type { PricingSnapshot } from '../frontend/types/engines';
import { resolveBytePlusSeedreamOutputPricing } from '../frontend/src/server/images/byteplus-seedream-pricing.ts';

test('keeps Seedream pricing when BytePlus returns the requested image count', () => {
  const pricing = { totalCents: 32, currency: 'USD' } as PricingSnapshot;
  const result = resolveBytePlusSeedreamOutputPricing({
    generatedImages: 6,
    priceOnlyReceipts: true,
    pricing,
    requestedImages: 6,
  });

  assert.equal(result.adjustedPricing.totalCents, 32);
  assert.equal(result.partialRefundCents, 0);
  assert.equal(result.missingImages, 0);
  assert.equal(result.adjustedPricingSnapshotJson, JSON.stringify({ totalCents: 32, currency: 'USD' }));
});

test('adjusts Seedream pricing when BytePlus returns fewer images than requested', () => {
  const result = resolveBytePlusSeedreamOutputPricing({
    generatedImages: 5,
    priceOnlyReceipts: true,
    pricing: { totalCents: 32, currency: 'USD' } as PricingSnapshot,
    requestedImages: 6,
  });

  assert.equal(result.adjustedPricing.totalCents, 27);
  assert.equal(result.partialRefundCents, 5);
  assert.equal(result.missingImages, 1);
  assert.equal(result.adjustedPricingSnapshotJson, JSON.stringify({ totalCents: 27, currency: 'USD' }));
  assert.deepEqual(result.adjustedPricing.meta, {
    generatedImages: 5,
    missingImages: 1,
    originalRequestedImages: 6,
    originalTotalCents: 32,
    partialRefundCents: 5,
    pricingAdjustedForGeneratedImages: true,
  });
});
