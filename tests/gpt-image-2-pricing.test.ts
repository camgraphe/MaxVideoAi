import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { computePricingSnapshot } from '../frontend/src/lib/pricing.ts';
import { POST as estimateImagePricing } from '../frontend/app/api/images/estimate/route.ts';

test('GPT Image 2 pricing responds to Fal quality and image_size', async () => {
  const engine = listFalEngines().find((entry) => entry.id === 'gpt-image-2')?.engine;
  assert.ok(engine);

  const low = await computePricingSnapshot({
    engine,
    durationSec: 1,
    resolution: '1024x768',
    quality: 'low',
    currency: 'USD',
  });
  const highSquare = await computePricingSnapshot({
    engine,
    durationSec: 1,
    resolution: 'square_hd',
    quality: 'high',
    currency: 'USD',
  });
  const high4k = await computePricingSnapshot({
    engine,
    durationSec: 1,
    resolution: '3840x2160',
    quality: 'high',
    currency: 'USD',
  });
  const custom4kMedium = await computePricingSnapshot({
    engine,
    durationSec: 1,
    resolution: 'custom',
    customImageSize: { width: 3840, height: 2160 },
    quality: 'medium',
    currency: 'USD',
  });

  assert.equal(low.base.amountCents, 1);
  assert.equal(low.meta?.quality, 'low');
  assert.equal(low.meta?.billed_image_size, '1024x768');
  assert.equal(highSquare.base.amountCents, 22);
  assert.equal(highSquare.meta?.billed_image_size, '1024x1024');
  assert.equal(high4k.base.amountCents, 41);
  assert.equal(high4k.meta?.billed_image_size, '3840x2160');
  assert.equal(custom4kMedium.base.amountCents, 11);
  assert.equal(custom4kMedium.meta?.requested_image_width, 3840);
  assert.equal(custom4kMedium.meta?.requested_image_height, 2160);
});

test('GPT Image 2 estimate is available to guests and returns the client price with margin', async () => {
  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 't2i',
        numImages: 1,
        resolution: '1024x768',
        quality: 'high',
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      margin: { amountCents: number; percentApplied: number };
      platformFeeCents: number;
      vendorShareCents: number;
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.pricing?.base.amountCents, 15);
  assert.equal(payload.pricing?.margin.amountCents, 5);
  assert.equal(payload.pricing?.margin.percentApplied, 0.3);
  assert.equal(payload.pricing?.totalCents, 20);
  assert.equal(payload.pricing?.platformFeeCents, 5);
  assert.equal(payload.pricing?.vendorShareCents, 15);
});
