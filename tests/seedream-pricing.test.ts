import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { computeCanonicalPublicSnapshot as computePricingSnapshot } from '../frontend/server/pricing/quote-public.ts';

function getSeedreamEngine() {
  const engine = listFalEngines().find((entry) => entry.id === 'seedream')?.engine;
  assert.ok(engine, 'Seedream engine should be registered');
  return engine;
}

test('Seedream image-set pricing scales through the full 15 image provider limit', async () => {
  const engine = getSeedreamEngine();

  const fourImages = await computePricingSnapshot({
    engine,
    durationSec: 4,
    resolution: '2K',
    currency: 'USD',
  });
  const fifteenImages = await computePricingSnapshot({
    engine,
    durationSec: 15,
    resolution: '2K',
    currency: 'USD',
  });

  assert.equal(fourImages.base.seconds, 4);
  assert.equal(fifteenImages.base.seconds, 15);
  assert.ok(fifteenImages.totalCents > fourImages.totalCents);
});
