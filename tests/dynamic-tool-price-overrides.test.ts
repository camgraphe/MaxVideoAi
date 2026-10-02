import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUpscalePricingPreview } from '../frontend/src/lib/tools-upscale';
import { buildBackgroundRemovalPricingPreview } from '../frontend/src/lib/tools-background-removal';

test('video upscale applies the product coefficient without changing supplier units or its minimum', () => {
  const input = { mediaType: 'video' as const, engineId: 'topaz-video' as const, unitPriceCents: 3,
    targetResolution: '1080p' as const, videoMetadata: { width: 1280, height: 720, durationSec: 10, fps: 30 } };
  assert.equal(buildUpscalePricingPreview(input).totalCents, 80);
  assert.equal(buildUpscalePricingPreview({ ...input, priceMultiplier: 2.5 }).totalCents, 50);
  assert.equal(buildUpscalePricingPreview({ ...input, unitPriceCents: 60, priceMultiplier: 2.5 }).totalCents, 60);
});

test('background removal preserves whole-second and four-decimal rounding with an edited coefficient', () => {
  const input = { unitPriceCents: 3, durationSec: 10.25, outputCodec: 'webm_vp9' };
  assert.equal(buildBackgroundRemovalPricingPreview(input).totalCents, 10);
  const edited = buildBackgroundRemovalPricingPreview({ ...input, priceMultiplier: 3 });
  assert.equal(edited.totalCents, 15);
  assert.equal(edited.estimate?.durationSec, 11);
  assert.equal(edited.estimate?.priceMultiplier, 3);
});
