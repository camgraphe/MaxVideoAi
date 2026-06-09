import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32ReferencePrice,
} from '../frontend/src/lib/luma-agents-pricing';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { computePricingSnapshot } from '../frontend/src/lib/pricing.ts';

function getEngine(id: string) {
  const engine = listFalEngines().find((entry) => entry.id === id)?.engine;
  assert.ok(engine, `${id} should be registered`);
  return engine;
}

test('Luma Uni-1 fal-reference pricing uses source/reference image counts', () => {
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 't2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.042
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 'i2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.045
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1',
      mode: 'i2i',
      referenceImageCount: 3,
    }).totalUsd,
    0.054
  );
});

test('Luma Uni-1 Max fal-reference pricing charges source plus references separately', () => {
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1-max',
      mode: 't2i',
      referenceImageCount: 0,
    }).totalUsd,
    0.102
  );
  assert.equal(
    calculateLumaAgentsImageReferencePrice({
      engineId: 'luma-uni-1-max',
      mode: 'i2i',
      referenceImageCount: 2,
    }).totalUsd,
    0.111
  );
});

test('Luma Ray 3.2 fal-reference pricing uses 5s and 10s totals by resolution', () => {
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '540p' }).totalUsd, 0.5);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '720p' }).totalUsd, 1);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '1080p' }).totalUsd, 2);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '540p' }).totalUsd, 1);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '720p' }).totalUsd, 2);
  assert.equal(calculateLumaRay32ReferencePrice({ duration: '10s', resolution: '1080p' }).totalUsd, 4);
});

test('Luma Ray 3.2 rejects non-public fallback-safe pricing combinations', () => {
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '9s', resolution: '720p' }),
    /Luma Ray 3.2 supports 5s or 10s/
  );
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '5s', resolution: '4k' }),
    /Luma Ray 3.2 supports 540p, 720p, or 1080p/
  );
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: undefined, resolution: '720p' }),
    /Luma Ray 3.2 supports 5s or 10s/
  );
  assert.throws(
    () => calculateLumaRay32ReferencePrice({ duration: '5s', resolution: undefined }),
    /Luma Ray 3.2 supports 540p, 720p, or 1080p/
  );
});

test('Luma Uni-1 t2i snapshot uses fal reference base with MaxVideoAI margin', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-uni-1'),
    mode: 't2i',
    durationSec: 1,
    resolution: '2K',
    currency: 'USD',
    referenceImageCount: 0,
  });

  assert.equal(snapshot.base.amountCents, 4);
  assert.equal(snapshot.margin.percentApplied, 0.3);
  assert.equal(snapshot.margin.amountCents, 2);
  assert.equal(snapshot.totalCents, 6);
  assert.equal(snapshot.meta?.provider_cost_source, 'fal_reference_price');
  assert.equal(snapshot.meta?.pricing_model, 'fal_reference_plus_margin');
});

test('Luma Uni-1 t2i snapshot charges all text references', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-uni-1'),
    mode: 't2i',
    durationSec: 1,
    resolution: '2K',
    currency: 'USD',
    referenceImageCount: 2,
  });

  assert.equal(snapshot.base.amountCents, 5);
  assert.equal(snapshot.margin.amountCents, 2);
  assert.equal(snapshot.totalCents, 7);
  assert.equal(snapshot.meta?.source_or_reference_image_count, 2);
  assert.equal(
    (snapshot.meta?.cost_breakdown_usd as { source_or_reference_image_count?: number } | undefined)
      ?.source_or_reference_image_count,
    2
  );
});

test('Luma Uni-1 Max i2i snapshot charges source plus extra references', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-uni-1-max'),
    mode: 'i2i',
    durationSec: 1,
    resolution: '2K',
    currency: 'USD',
    referenceImageCount: 2,
  });

  assert.equal(snapshot.base.amountCents, 11);
  assert.equal(snapshot.margin.amountCents, 4);
  assert.equal(snapshot.totalCents, 15);
  assert.equal(snapshot.meta?.source_or_reference_image_count, 3);
});

test('Luma Ray 3.2 snapshot uses fal reference totals with rounded-up margin', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-ray-3-2'),
    mode: 't2v',
    durationSec: 10,
    durationOption: '10s',
    resolution: '1080p',
    currency: 'USD',
  });

  assert.equal(snapshot.base.amountCents, 400);
  assert.equal(snapshot.margin.amountCents, 120);
  assert.equal(snapshot.totalCents, 520);
  assert.equal(snapshot.meta?.provider_cost_source, 'fal_reference_price');
  assert.equal(snapshot.meta?.duration_label, '10s');
  assert.equal(snapshot.meta?.resolution, '1080p');
});

test('Luma Ray 3.2 snapshot rejects missing or unsupported public pricing dimensions', async () => {
  await assert.rejects(
    computePricingSnapshot({
      engine: getEngine('luma-ray-3-2'),
      mode: 't2v',
      durationSec: 9,
      resolution: '720p',
      currency: 'USD',
    }),
    /Luma Ray 3.2 supports 5s or 10s/
  );
  await assert.rejects(
    computePricingSnapshot({
      engine: getEngine('luma-ray-3-2'),
      mode: 't2v',
      durationSec: 5,
      durationOption: '5s',
      resolution: '4k',
      currency: 'USD',
    }),
    /Luma Ray 3.2 supports 540p, 720p, or 1080p/
  );
});
