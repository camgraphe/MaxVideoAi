import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { computePricingSnapshot } from '../frontend/src/lib/pricing.ts';
import { computeMarketingPricePoints, computeMarketingPriceRange } from '../frontend/src/lib/pricing-marketing.ts';
import { POST as estimateImagePricing } from '../frontend/app/api/images/estimate/route.ts';
import { resolveGptImage2AutoInputImageSize } from '../frontend/lib/image/gptImage2.ts';
import { getStoryboardOutputConfig } from '../frontend/src/components/tools/storyboard/_lib/storyboard-templates.ts';

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
  assert.equal(low.margin.amountCents, 1);
  assert.equal(low.totalCents, 2);
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

test('GPT Image 2 marketing pricing includes low, medium, and high image tiers', async () => {
  const engine = listFalEngines().find((entry) => entry.id === 'gpt-image-2')?.engine;
  assert.ok(engine);

  const points = await computeMarketingPricePoints(engine, { memberTier: 'member', limit: null });
  const range = await computeMarketingPriceRange(engine, { memberTier: 'member', limit: null });

  assert.equal(points.length, 18);
  assert.ok(points.some((point) => point.resolution === '1024x768' && point.quality === 'low' && point.cents === 2));
  assert.ok(points.some((point) => point.resolution === '3840x2160' && point.quality === 'high' && point.cents === 54));
  assert.equal(range?.min.cents, 2);
  assert.equal(range?.min.quality, 'low');
  assert.equal(range?.max.cents, 54);
  assert.equal(range?.max.quality, 'high');
});

test('GPT Image 2 one-cent Fal cost is rounded up after margin', async () => {
  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 't2i',
        numImages: 1,
        resolution: '1024x768',
        quality: 'low',
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
  assert.equal(payload.pricing?.base.amountCents, 1);
  assert.equal(payload.pricing?.margin.amountCents, 1);
  assert.equal(payload.pricing?.margin.percentApplied, 0.3);
  assert.equal(payload.pricing?.totalCents, 2);
  assert.equal(payload.pricing?.platformFeeCents, 1);
  assert.equal(payload.pricing?.vendorShareCents, 1);
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

test('GPT Image 2 storyboard estimates charge exactly 3x provider cost', async () => {
  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 't2i',
        numImages: 1,
        resolution: '1024x768',
        quality: 'medium',
        source: 'storyboard',
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      margin: { amountCents: number; percentApplied?: number };
      platformFeeCents: number;
      vendorShareCents: number;
      meta?: {
        pricing_model?: string;
        source?: string;
        engineId?: string;
        engineLabel?: string;
        billingEngineId?: string;
        billingEngineLabel?: string;
        billingProductLabel?: string;
        storyboard_multiplier?: number;
        storyboard_tier?: string;
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.pricing?.base.amountCents, 4);
  assert.equal(payload.pricing?.margin.amountCents, 8);
  assert.equal(payload.pricing?.margin.percentApplied, 2);
  assert.equal(payload.pricing?.totalCents, 12);
  assert.equal(payload.pricing?.platformFeeCents, 8);
  assert.equal(payload.pricing?.vendorShareCents, 4);
  assert.equal(payload.pricing?.meta?.pricing_model, 'storyboarder_x3');
  assert.equal(payload.pricing?.meta?.source, 'storyboard');
  assert.equal(payload.pricing?.meta?.engineId, 'storyboarder');
  assert.equal(payload.pricing?.meta?.engineLabel, 'Storyboarder');
  assert.equal(payload.pricing?.meta?.billingEngineId, 'storyboarder');
  assert.equal(payload.pricing?.meta?.billingEngineLabel, 'Storyboarder');
  assert.equal(payload.pricing?.meta?.billingProductLabel, 'Storyboarder');
  assert.equal(payload.pricing?.meta?.storyboard_multiplier, 3);
  assert.equal(payload.pricing?.meta?.storyboard_tier, 'hd');
});

test('GPT Image 2 storyboard edit estimates charge exactly 2x provider cost', async () => {
  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 'i2i',
        numImages: 1,
        referenceImageSizes: [{ width: 1600, height: 1000 }],
        resolution: '1024x768',
        quality: 'medium',
        source: 'storyboard_edit',
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      margin: { amountCents: number; percentApplied?: number };
      platformFeeCents: number;
      vendorShareCents: number;
      meta?: {
        pricing_model?: string;
        source?: string;
        engineId?: string;
        engineLabel?: string;
        billingEngineId?: string;
        billingEngineLabel?: string;
        billingProductLabel?: string;
        storyboard_edit_multiplier?: number;
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.pricing?.base.amountCents, 4);
  assert.equal(payload.pricing?.margin.amountCents, 4);
  assert.equal(payload.pricing?.margin.percentApplied, 1);
  assert.equal(payload.pricing?.totalCents, 8);
  assert.equal(payload.pricing?.platformFeeCents, 4);
  assert.equal(payload.pricing?.vendorShareCents, 4);
  assert.equal(payload.pricing?.meta?.pricing_model, 'storyboarder_edit_x2');
  assert.equal(payload.pricing?.meta?.source, 'storyboard_edit');
  assert.equal(payload.pricing?.meta?.engineId, 'storyboarder');
  assert.equal(payload.pricing?.meta?.engineLabel, 'Storyboarder');
  assert.equal(payload.pricing?.meta?.billingEngineId, 'storyboarder');
  assert.equal(payload.pricing?.meta?.billingEngineLabel, 'Storyboarder');
  assert.equal(payload.pricing?.meta?.billingProductLabel, 'Storyboarder edit');
  assert.equal(payload.pricing?.meta?.storyboard_edit_multiplier, 2);
});

test('GPT Image 2 storyboard edit auto pricing follows the selected storyboard dimensions', async () => {
  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 'i2i',
        numImages: 1,
        referenceImageSizes: [{ width: 3840, height: 2160 }],
        resolution: 'auto',
        quality: 'medium',
        source: 'storyboard_edit',
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      margin: { amountCents: number; percentApplied?: number };
      meta?: {
        billed_image_size?: string;
        requested_image_width?: number;
        requested_image_height?: number;
        source?: string;
        storyboard_edit_multiplier?: number;
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.pricing?.base.amountCents, 11);
  assert.equal(payload.pricing?.margin.amountCents, 11);
  assert.equal(payload.pricing?.margin.percentApplied, 1);
  assert.equal(payload.pricing?.totalCents, 22);
  assert.equal(payload.pricing?.meta?.billed_image_size, '3840x2160');
  assert.equal(payload.pricing?.meta?.requested_image_width, 3840);
  assert.equal(payload.pricing?.meta?.requested_image_height, 2160);
  assert.equal(payload.pricing?.meta?.source, 'storyboard_edit');
  assert.equal(payload.pricing?.meta?.storyboard_edit_multiplier, 2);
});

test('GPT Image 2 storyboard portrait HD estimate uses a valid 9:16 custom size', async () => {
  const portraitHd = getStoryboardOutputConfig('hd', 'portrait');
  assert.equal(portraitHd.resolution, 'custom');
  assert.deepEqual(portraitHd.customImageSize, { width: 1152, height: 2048 });

  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 'i2i',
        numImages: 1,
        referenceImageSizes: [{ width: 1000, height: 1600 }],
        resolution: portraitHd.resolution,
        customImageSize: portraitHd.customImageSize,
        quality: portraitHd.quality,
        source: 'storyboard',
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      margin: { amountCents: number; percentApplied?: number };
      meta?: {
        requested_image_width?: number;
        requested_image_height?: number;
        storyboard_tier?: string;
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.pricing?.base.amountCents, 4);
  assert.equal(payload.pricing?.margin.amountCents, 8);
  assert.equal(payload.pricing?.totalCents, 12);
  assert.equal(payload.pricing?.margin.percentApplied, 2);
  assert.equal(payload.pricing?.meta?.requested_image_width, 1152);
  assert.equal(payload.pricing?.meta?.requested_image_height, 2048);
  assert.equal(payload.pricing?.meta?.storyboard_tier, 'hd');
});

test('GPT Image 2 storyboard 4K medium tier is cheaper than 4K ultra', async () => {
  const fourK = getStoryboardOutputConfig('4k', 'landscape');
  const ultra = getStoryboardOutputConfig('ultra', 'landscape');
  assert.deepEqual(fourK, { resolution: '3840x2160', customImageSize: null, quality: 'medium' });
  assert.deepEqual(ultra, { resolution: '3840x2160', customImageSize: null, quality: 'high' });

  const fourKResponse = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 'i2i',
        numImages: 1,
        referenceImageSizes: [{ width: 1600, height: 1000 }],
        resolution: fourK.resolution,
        quality: fourK.quality,
        source: 'storyboard',
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const ultraResponse = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 'i2i',
        numImages: 1,
        referenceImageSizes: [{ width: 1600, height: 1000 }],
        resolution: ultra.resolution,
        quality: ultra.quality,
        source: 'storyboard',
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const fourKPayload = (await fourKResponse.json()) as {
    pricing?: { totalCents: number; base: { amountCents: number }; meta?: { storyboard_tier?: string } };
  };
  const ultraPayload = (await ultraResponse.json()) as {
    pricing?: { totalCents: number; base: { amountCents: number }; meta?: { storyboard_tier?: string } };
  };

  assert.equal(fourKPayload.pricing?.base.amountCents, 11);
  assert.equal(fourKPayload.pricing?.totalCents, 33);
  assert.equal(fourKPayload.pricing?.meta?.storyboard_tier, '4k');
  assert.equal(ultraPayload.pricing?.base.amountCents, 41);
  assert.equal(ultraPayload.pricing?.totalCents, 123);
  assert.equal(ultraPayload.pricing?.meta?.storyboard_tier, 'ultra');
});

test('GPT Image 2 Kling storyboard estimate bundles the included HD first frame into one charge', async () => {
  const fourK = getStoryboardOutputConfig('4k', 'landscape');
  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 'i2i',
        numImages: 1,
        referenceImageSizes: [{ width: 1600, height: 1000 }],
        resolution: fourK.resolution,
        quality: fourK.quality,
        source: 'storyboard',
        metadata: { storyboard: { role: 'board', targetModel: 'kling' } },
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const payload = (await response.json()) as {
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      meta?: {
        pricing_model?: string;
        storyboard_includes_kling_first_frame?: boolean;
        storyboard_board_total_cents?: number;
        storyboard_kling_first_frame_total_cents?: number;
      };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.pricing?.base.amountCents, 15);
  assert.equal(payload.pricing?.totalCents, 45);
  assert.equal(payload.pricing?.meta?.pricing_model, 'storyboarder_kling_bundle_x3');
  assert.equal(payload.pricing?.meta?.storyboard_includes_kling_first_frame, true);
  assert.equal(payload.pricing?.meta?.storyboard_board_total_cents, 33);
  assert.equal(payload.pricing?.meta?.storyboard_kling_first_frame_total_cents, 12);
});

test('GPT Image 2 auto edit pricing can follow reference image dimensions', async () => {
  const inferredSize = resolveGptImage2AutoInputImageSize([{ width: 3840, height: 2160 }]);
  assert.deepEqual(inferredSize, { width: 3840, height: 2160 });

  const response = await estimateImagePricing(
    new Request('http://localhost:3000/api/images/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineId: 'gpt-image-2',
        mode: 'i2i',
        numImages: 1,
        resolution: 'auto',
        quality: 'low',
        referenceImageSizes: [{ width: 3840, height: 2160 }],
      }),
    }) as Parameters<typeof estimateImagePricing>[0]
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    pricing?: {
      totalCents: number;
      base: { amountCents: number };
      margin: { amountCents: number };
      meta?: { billed_image_size?: string };
    };
  };

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.pricing?.base.amountCents, 2);
  assert.equal(payload.pricing?.margin.amountCents, 1);
  assert.equal(payload.pricing?.totalCents, 3);
  assert.equal(payload.pricing?.meta?.billed_image_size, '3840x2160');
});
