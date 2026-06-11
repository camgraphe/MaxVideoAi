import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateLumaAgentsImageReferencePrice,
  calculateLumaRay32DirectPrice,
  calculateLumaRay32ReferencePrice,
} from '../frontend/src/lib/luma-agents-pricing';
import { POST as estimateImagePricing } from '../frontend/app/api/images/estimate/route.ts';
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

test('Luma Ray 3.2 direct pricing covers Modify and Reframe public API costs', () => {
  assert.equal(
    calculateLumaRay32DirectPrice({
      mode: 'v2v',
      durationSec: 5,
      duration: '5s',
      resolution: '720p',
    }).totalUsd,
    1.08
  );
  assert.equal(
    calculateLumaRay32DirectPrice({
      mode: 'v2v',
      durationSec: 10,
      duration: '10s',
      resolution: '1080p',
    }).totalUsd,
    4.32
  );
  assert.equal(
    calculateLumaRay32DirectPrice({
      mode: 'reframe',
      durationSec: 8,
      duration: null,
      resolution: '720p',
    }).totalUsd,
    1.6
  );
  assert.equal(
    calculateLumaRay32DirectPrice({
      mode: 'v2v',
      durationSec: 5,
      duration: '5s',
      resolution: '720p',
      hdr: true,
    }).totalUsd,
    2.16
  );
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

  assert.equal(snapshot.base.amountCents, 5);
  assert.equal(snapshot.vendorShareCents, 5);
  assert.equal(snapshot.margin.percentApplied, 0.3);
  assert.equal(snapshot.margin.amountCents, 1);
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

test('Luma Uni-1 Max t2i snapshot applies margin to exact fal reference cost', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-uni-1-max'),
    mode: 't2i',
    durationSec: 1,
    resolution: '2K',
    currency: 'USD',
    referenceImageCount: 0,
  });

  assert.equal(snapshot.base.amountCents, 11);
  assert.equal(snapshot.margin.amountCents, 3);
  assert.equal(snapshot.totalCents, 14);
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

  assert.equal(snapshot.base.amountCents, 12);
  assert.equal(snapshot.margin.amountCents, 3);
  assert.equal(snapshot.totalCents, 15);
  assert.equal(snapshot.meta?.source_or_reference_image_count, 3);
});

test('Luma Uni t2i estimate counts reference image sizes when image URLs are not posted', async () => {
  const withUrlsResponse = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'luma-uni-1',
        mode: 't2i',
        numImages: 1,
        resolution: '2K',
        imageUrls: ['https://cdn.example.com/a.png', 'https://cdn.example.com/b.png'],
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const withSizesResponse = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'luma-uni-1',
        mode: 't2i',
        numImages: 1,
        resolution: '2K',
        referenceImageSizes: [
          { width: 1024, height: 1024 },
          { width: 1024, height: 1024 },
        ],
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const withUrlsPayload = (await withUrlsResponse.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      meta?: { source_or_reference_image_count?: number };
    };
  };
  const withSizesPayload = (await withSizesResponse.json()) as typeof withUrlsPayload;

  assert.equal(withUrlsResponse.status, 200);
  assert.equal(withSizesResponse.status, 200);
  assert.equal(withUrlsPayload.ok, true);
  assert.equal(withSizesPayload.ok, true);
  assert.equal(withSizesPayload.pricing?.base.amountCents, withUrlsPayload.pricing?.base.amountCents);
  assert.equal(withSizesPayload.pricing?.totalCents, withUrlsPayload.pricing?.totalCents);
  assert.equal(withSizesPayload.pricing?.totalCents, 7);
  assert.equal(withSizesPayload.pricing?.meta?.source_or_reference_image_count, 2);
});

test('Luma Uni i2i estimate counts source plus extra reference sizes when image URLs are not posted', async () => {
  const withUrlsResponse = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'luma-uni-1-max',
        mode: 'i2i',
        numImages: 1,
        resolution: '2K',
        imageUrls: [
          'https://cdn.example.com/source.png',
          'https://cdn.example.com/ref-a.png',
          'https://cdn.example.com/ref-b.png',
        ],
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const withSizesResponse = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'luma-uni-1-max',
        mode: 'i2i',
        numImages: 1,
        resolution: '2K',
        referenceImageSizes: [
          { width: 1024, height: 1024 },
          { width: 1024, height: 1024 },
          { width: 1024, height: 1024 },
        ],
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const withUrlsPayload = (await withUrlsResponse.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      meta?: { source_or_reference_image_count?: number };
    };
  };
  const withSizesPayload = (await withSizesResponse.json()) as typeof withUrlsPayload;

  assert.equal(withUrlsResponse.status, 200);
  assert.equal(withSizesResponse.status, 200);
  assert.equal(withUrlsPayload.ok, true);
  assert.equal(withSizesPayload.ok, true);
  assert.equal(withSizesPayload.pricing?.base.amountCents, withUrlsPayload.pricing?.base.amountCents);
  assert.equal(withSizesPayload.pricing?.totalCents, withUrlsPayload.pricing?.totalCents);
  assert.equal(withSizesPayload.pricing?.totalCents, 15);
  assert.equal(withSizesPayload.pricing?.meta?.source_or_reference_image_count, 3);
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

test('Luma Ray 3.2 snapshot applies membership discount after fal reference margin', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-ray-3-2'),
    mode: 't2v',
    durationSec: 10,
    durationOption: '10s',
    resolution: '1080p',
    currency: 'USD',
    membershipTier: 'plus',
  });

  assert.equal(snapshot.base.amountCents, 400);
  assert.equal(snapshot.subtotalBeforeDiscountCents, 520);
  assert.equal(snapshot.discount?.amountCents, 26);
  assert.equal(snapshot.totalCents, 494);
  assert.equal(snapshot.platformFeeCents, 94);
  assert.equal(snapshot.vendorShareCents, 400);
});

test('Luma Ray 3.2 Modify snapshot uses Fal-interpolated cost with configured margin', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-ray-3-2'),
    mode: 'v2v',
    durationSec: 5,
    durationOption: '5s',
    resolution: '720p',
    currency: 'USD',
  });

  assert.equal(snapshot.base.amountCents, 108);
  assert.equal(snapshot.margin.amountCents, 33);
  assert.equal(snapshot.totalCents, 141);
  assert.equal(snapshot.meta?.pricing_model, 'fal_reference_interpolated_plus_margin');
  assert.equal(snapshot.meta?.provider_cost_source, 'fal_luma_ray_3_2_video_edit_interpolated');
  assert.equal(snapshot.meta?.duration_label, '5s');
});

test('Luma Ray 3.2 Reframe snapshot uses Fal-interpolated per-second cost with configured margin', async () => {
  const snapshot = await computePricingSnapshot({
    engine: getEngine('luma-ray-3-2'),
    mode: 'reframe',
    durationSec: 8,
    resolution: '720p',
    currency: 'USD',
  });

  assert.equal(snapshot.base.amountCents, 160);
  assert.equal(snapshot.margin.amountCents, 48);
  assert.equal(snapshot.totalCents, 208);
  assert.equal(snapshot.base.seconds, 8);
  assert.equal(snapshot.meta?.pricing_model, 'fal_reference_interpolated_plus_margin');
  assert.equal(snapshot.meta?.provider_cost_source, 'fal_luma_ray_3_2_reframe_interpolated');
  assert.equal(snapshot.meta?.duration_label, 'per_second');
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
