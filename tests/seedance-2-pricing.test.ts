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

const DEFAULT_MAXVIDEOAI_MARGIN_FACTOR = 1.3;

function targetCustomerUnitPriceUsdPer1kTokens(unitPriceUsdPer1kTokens: number): number {
  return Number((unitPriceUsdPer1kTokens * DEFAULT_MAXVIDEOAI_MARGIN_FACTOR).toFixed(6));
}

test('Seedance 2 token quote follows dimensions and targets 2.5x BytePlus no-video pricing', () => {
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
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(quote.unitPriceUsdPer1kTokens), 0.0175);
  assert.equal(quote.vendorCostUsd, 0.290769);
});

test('Seedance 2 pricing snapshot lands on the 2.5x BytePlus public target after margin', async () => {
  const engine = getEngine('seedance-2-0');

  const snapshot = await computePricingSnapshot({
    engine,
    durationSec: 10,
    resolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
  });

  assert.equal(snapshot.totalCents, 378);
  assert.equal(snapshot.base.amountCents, 291);
  assert.equal(snapshot.platformFeeCents, 87);
  assert.equal(snapshot.vendorShareCents, 291);
  assert.equal(snapshot.meta?.pricing_model, 'byteplus_tokens');
  assert.equal(snapshot.meta?.provider_cost_source, 'byteplus_modelark_pricing_config');
  assert.equal(snapshot.meta?.output_width, 1280);
  assert.equal(snapshot.meta?.output_height, 720);
  assert.equal(snapshot.meta?.token_count, 216000);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(snapshot.meta?.unit_price_usd_per_1k_tokens as number), 0.0175);
});

test('Seedance 2 Fast uses the lower 2.5x BytePlus Fast public target', async () => {
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

  assert.equal(standardSnapshot.totalCents, 189);
  assert.equal(fastSnapshot.totalCents, 152);
  assert.ok(fastSnapshot.totalCents < standardSnapshot.totalCents);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(fastSnapshot.meta?.unit_price_usd_per_1k_tokens as number), 0.014);
});

test('Seedance 2 Standard uses flat 2.5x BytePlus no-video targets across video input types', async () => {
  const engine = getEngine('seedance-2-0');
  assert.ok(isSeedance2TokenPricing(engine.pricingDetails));

  const noVideoQuote = computeSeedance2TokenQuote({
    details: engine.pricingDetails,
    durationSec: 1,
    resolution: '4k',
    aspectRatio: '16:9',
    billingInputType: 'no_video_input',
  });
  const videoQuote = computeSeedance2TokenQuote({
    details: engine.pricingDetails,
    durationSec: 1,
    resolution: '4k',
    aspectRatio: '16:9',
    billingInputType: 'video_input',
  });
  const hdQuote = computeSeedance2TokenQuote({
    details: engine.pricingDetails,
    durationSec: 1,
    resolution: '1080p',
    aspectRatio: '16:9',
    billingInputType: 'no_video_input',
  });

  assert.equal(noVideoQuote.width, 3840);
  assert.equal(noVideoQuote.height, 2160);
  assert.equal(noVideoQuote.tokenCount, 194400);
  assert.equal(noVideoQuote.vendorCostUsd, 1.495385);
  assert.equal(videoQuote.vendorCostUsd, 1.495385);
  assert.equal(hdQuote.vendorCostUsd, 0.719654);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(noVideoQuote.unitPriceUsdPer1kTokens), 0.01);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(videoQuote.unitPriceUsdPer1kTokens), 0.01);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(hdQuote.unitPriceUsdPer1kTokens), 0.01925);

  const noVideoSnapshot = await computePricingSnapshot({
    engine,
    durationSec: 1,
    resolution: '4k',
    aspectRatio: '16:9',
    membershipTier: 'member',
    hasVideoInput: false,
  });
  const videoSnapshot = await computePricingSnapshot({
    engine,
    durationSec: 1,
    resolution: '4k',
    aspectRatio: '16:9',
    membershipTier: 'member',
    hasVideoInput: true,
  });

  assert.equal(noVideoSnapshot.totalCents, 195);
  assert.equal(noVideoSnapshot.base.amountCents, 150);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(noVideoSnapshot.meta?.unit_price_usd_per_1k_tokens as number), 0.01);
  assert.equal(noVideoSnapshot.meta?.output_width, 3840);
  assert.equal(noVideoSnapshot.meta?.output_height, 2160);
  assert.equal(videoSnapshot.totalCents, 195);
  assert.equal(videoSnapshot.base.amountCents, 150);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(videoSnapshot.meta?.unit_price_usd_per_1k_tokens as number), 0.01);
});

test('Seedance 2 Standard 4K uses BytePlus canonical dimensions for non-16:9 ratios', () => {
  const engine = getEngine('seedance-2-0');
  assert.ok(isSeedance2TokenPricing(engine.pricingDetails));

  assert.deepEqual(
    computeSeedance2TokenQuote({
      details: engine.pricingDetails,
      durationSec: 1,
      resolution: '4k',
      aspectRatio: '4:3',
      billingInputType: 'no_video_input',
    }),
    {
      aspectRatio: '4:3',
      width: 3326,
      height: 2494,
      frameRate: 24,
      tokenCount: 194415.09375,
      unitPriceUsdPer1kTokens: 0.007692307692307692,
      vendorCostUsd: 1.495501,
      vendorCostPerSecondUsd: 1.495501,
      billingInputType: 'no_video_input',
      pricingSource: undefined,
    }
  );

  const ultrawide = computeSeedance2TokenQuote({
    details: engine.pricingDetails,
    durationSec: 1,
    resolution: '4k',
    aspectRatio: '21:9',
    billingInputType: 'video_input',
  });
  assert.equal(ultrawide.width, 4398);
  assert.equal(ultrawide.height, 1886);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(ultrawide.unitPriceUsdPer1kTokens), 0.01);
});

test('Seedance 2 Mini uses one 2.5x BytePlus no-video public target for every input type', async () => {
  const engine = getEngine('seedance-2-0-mini');
  assert.ok(isSeedance2TokenPricing(engine.pricingDetails));

  const noVideoQuote = computeSeedance2TokenQuote({
    details: engine.pricingDetails,
    durationSec: 1,
    resolution: '720p',
    aspectRatio: '16:9',
    billingInputType: 'no_video_input',
  });
  const videoQuote = computeSeedance2TokenQuote({
    details: engine.pricingDetails,
    durationSec: 1,
    resolution: '720p',
    aspectRatio: '16:9',
    billingInputType: 'video_input',
  });

  assert.equal(noVideoQuote.tokenCount, 21600);
  assert.equal(noVideoQuote.vendorCostUsd, 0.145385);
  assert.equal(videoQuote.vendorCostUsd, 0.145385);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(noVideoQuote.unitPriceUsdPer1kTokens), 0.00875);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(videoQuote.unitPriceUsdPer1kTokens), 0.00875);

  const noVideoSnapshot = await computePricingSnapshot({
    engine,
    durationSec: 10,
    resolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
    hasVideoInput: false,
  });
  const videoSnapshot = await computePricingSnapshot({
    engine,
    durationSec: 10,
    resolution: '720p',
    aspectRatio: '16:9',
    membershipTier: 'member',
    hasVideoInput: true,
  });

  assert.equal(noVideoSnapshot.totalCents, 189);
  assert.equal(noVideoSnapshot.base.amountCents, 146);
  assert.equal(noVideoSnapshot.meta?.byteplus_billing_input_type, 'no_video_input');
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(noVideoSnapshot.meta?.unit_price_usd_per_1k_tokens as number), 0.00875);
  assert.equal(videoSnapshot.totalCents, 189);
  assert.equal(videoSnapshot.base.amountCents, 146);
  assert.equal(videoSnapshot.meta?.byteplus_billing_input_type, 'video_input');
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(videoSnapshot.meta?.unit_price_usd_per_1k_tokens as number), 0.00875);
});

test('Seedance 2 pricing changes with aspect ratio because BytePlus pricing follows output pixels', async () => {
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

  assert.equal(square.totalCents, 107);
  assert.ok(square.totalCents < landscape.totalCents);
});
