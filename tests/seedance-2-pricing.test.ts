import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { computePricingSnapshot } from '../frontend/src/lib/pricing.ts';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '../frontend/src/lib/seedance-2-pricing.ts';

function getEngine(engineId: string) {
  const engine = listFalEngines().find((entry) => entry.id === engineId)?.engine;
  assert.ok(engine, `Missing engine ${engineId}`);
  return engine;
}

test('Seedance 2 token quote follows Fal dimensions and token formula at 720p 16:9', () => {
  const engine = getEngine('seedance-2-0');
  assert.ok(isSeedance2TokenPricing(engine.pricingDetails));

  const quote = computeSeedance2TokenQuote({
    details: engine.pricingDetails,
    durationSec: 1,
    resolution: '720p',
    aspectRatio: '16:9',
  });

  assert.equal(quote.width, 1280);
  assert.equal(quote.height, 720);
  assert.equal(quote.frameRate, 24);
  assert.equal(quote.tokenCount, 21600);
  assert.equal(quote.vendorCostUsd, 0.3024);
});

test('Seedance 2 pricing snapshot adds the 30% MaxVideoAI margin and rounds up to the next cent', async () => {
  const engine = getEngine('seedance-2-0');

  const snapshot = await computePricingSnapshot({
    engine,
    durationSec: 10,
    resolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
  });

  assert.equal(snapshot.totalCents, 394);
  assert.equal(snapshot.base.amountCents, 303);
  assert.equal(snapshot.platformFeeCents, 91);
  assert.equal(snapshot.vendorShareCents, 303);
  assert.equal(snapshot.meta?.pricing_model, 'fal_tokens');
  assert.equal(snapshot.meta?.output_width, 1280);
  assert.equal(snapshot.meta?.output_height, 720);
  assert.equal(snapshot.meta?.token_count, 216000);
});

test('Seedance 2 Fast uses the lower Fal token rate', async () => {
  const standard = getEngine('seedance-2-0');
  const fast = getEngine('seedance-2-0-fast');

  const standardSnapshot = await computePricingSnapshot({
    engine: standard,
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
  });
  const fastSnapshot = await computePricingSnapshot({
    engine: fast,
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
  });

  assert.equal(standardSnapshot.totalCents, 197);
  assert.equal(fastSnapshot.totalCents, 158);
  assert.ok(fastSnapshot.totalCents < standardSnapshot.totalCents);
});

test('Seedance 2 pricing changes with aspect ratio because Fal charges on output pixels', async () => {
  const engine = getEngine('seedance-2-0');

  const landscape = await computePricingSnapshot({
    engine,
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
  });
  const square = await computePricingSnapshot({
    engine,
    durationSec: 5,
    resolution: '720p',
    aspectRatio: '1:1',
    membershipTier: 'member',
  });

  assert.equal(square.totalCents, 111);
  assert.ok(square.totalCents < landscape.totalCents);
});
