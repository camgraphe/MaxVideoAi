import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import {
  expectedBytePlusTokens,
  getBytePlusUnitPriceUsdPer1kTokens,
} from '../frontend/server/byteplus-accounting';
import { computeCanonicalPublicSnapshot as computePricingSnapshot } from '../frontend/server/pricing/quote-public.ts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts.ts';
import {
  projectPublicPricingSnapshot,
  quotePublicPricing,
} from '../frontend/src/lib/pricing-public-quote.ts';
import { computeSeedance2TokenQuote, isSeedance2TokenPricing } from '../frontend/src/lib/seedance-2-pricing.ts';

function getEngine(engineId: string) {
  const engine = listFalEngines().find((entry) => entry.id === engineId)?.engine;
  assert.ok(engine, `Missing engine ${engineId}`);
  return engine;
}

function getEngineEntry(engineId: string) {
  const entry = listFalEngines().find((candidate) => candidate.id === engineId);
  assert.ok(entry, `Missing engine entry ${engineId}`);
  return entry;
}

const DEFAULT_MAXVIDEOAI_MARGIN_FACTOR = 1.3;

function targetCustomerUnitPriceUsdPer1kTokens(unitPriceUsdPer1kTokens: number): number {
  return Number((unitPriceUsdPer1kTokens * DEFAULT_MAXVIDEOAI_MARGIN_FACTOR).toFixed(6));
}

test('Seedance 2.5 uses its own factual ModelArk input rates', () => {
  assert.equal(
    getBytePlusUnitPriceUsdPer1kTokens('seedance-2-5', 'no_video_input', '480p'),
    0.0107
  );
  assert.equal(
    getBytePlusUnitPriceUsdPer1kTokens('seedance-2-5', 'video_input', '720p'),
    0.0064
  );
});

test('BytePlus pricing still fails closed for an unknown Seedance engine', () => {
  assert.throws(
    () => getBytePlusUnitPriceUsdPer1kTokens('seedance-9-9', 'no_video_input', '720p'),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === 'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});

test('Seedance 2.5 public quotes cover no-video and video-input generation', async () => {
  const engine = getEngine('seedance-2-5');
  const scenarios = [
    {
      id: 't2v-4s-480p-audio-off',
      mode: 't2v' as const,
      durationSec: 4,
      resolution: '480p',
      audio: false,
      hasVideoInput: false,
      expectedInputType: 'no_video_input',
    },
    {
      id: 't2v-15s-720p-audio-on',
      mode: 't2v' as const,
      durationSec: 15,
      resolution: '720p',
      audio: true,
      hasVideoInput: false,
      expectedInputType: 'no_video_input',
    },
    {
      id: 'i2v-24s-720p-audio-off',
      mode: 'i2v' as const,
      durationSec: 24,
      resolution: '720p',
      audio: false,
      hasVideoInput: false,
      expectedInputType: 'no_video_input',
    },
    {
      id: 'v2v-15s-720p-audio-on',
      mode: 'v2v' as const,
      durationSec: 15,
      resolution: '720p',
      audio: true,
      hasVideoInput: true,
      expectedInputType: 'video_input',
    },
  ];
  const quotes = new Map<string, Awaited<ReturnType<typeof computePricingSnapshot>>>();

  for (const scenario of scenarios) {
    const facts = buildPublicPricingFacts({
      engine,
      mode: scenario.mode,
      durationSec: scenario.durationSec,
      resolution: scenario.resolution,
      aspectRatio: '16:9',
      hasVideoInput: scenario.hasVideoInput,
      addons: { audio: scenario.audio },
    });
    const publicQuote = quotePublicPricing({
      facts: facts.facts,
      scenario: {
        id: `public:seedance-2-5:${scenario.id}`,
        engineId: engine.id,
        mode: scenario.mode,
        resolution: scenario.resolution,
        membershipTier: 'member',
      },
      compatibilityProfileId: facts.compatibilityProfileId,
    });
    const publicSnapshot = projectPublicPricingSnapshot({
      quote: publicQuote,
      base: facts.base,
      addons: facts.addons,
      meta: facts.meta,
    });
    const snapshot = await computePricingSnapshot({
      engine,
      mode: scenario.mode,
      durationSec: scenario.durationSec,
      resolution: scenario.resolution,
      aspectRatio: '16:9',
      membershipTier: 'member',
      hasVideoInput: scenario.hasVideoInput,
      addons: { audio: scenario.audio },
    });

    assert.ok(snapshot.totalCents > 0, `${scenario.id} should have a positive customer total`);
    assert.equal(publicSnapshot.totalCents, snapshot.totalCents);
    assert.equal(
      snapshot.meta?.pricing_source,
      'byteplus_seedance_2_5_260628_approved_2_5x',
      `${scenario.id} should retain the approved pricing source`
    );
    assert.equal(
      (publicSnapshot.meta?.cost_breakdown_usd as { pricingSource?: string } | undefined)
        ?.pricingSource,
      'byteplus_seedance_2_5_260628_approved_2_5x'
    );
    assert.equal(snapshot.meta?.byteplus_billing_input_type, scenario.expectedInputType);
    assert.equal(
      (publicSnapshot.meta?.cost_breakdown_usd as { billingInputType?: string } | undefined)
        ?.billingInputType,
      scenario.expectedInputType
    );
    assert.equal(publicQuote.policyProvenance.compatibilityProfile, 'provider-reference-current');
    assert.deepEqual(snapshot.meta?.pricingPolicy, {
      source: 'versioned',
      matchedBy: 'global',
      sourceRuleId: 'default',
      compatibilityProfile: 'provider-reference-current',
    });
    quotes.set(scenario.id, snapshot);
  }

  assert.equal(quotes.get('t2v-4s-480p-audio-off')?.totalCents, 103);
  assert.equal(quotes.get('t2v-15s-720p-audio-on')?.totalCents, 867);
  assert.ok(
    Number(quotes.get('v2v-15s-720p-audio-on')?.totalCents) <
      Number(quotes.get('t2v-15s-720p-audio-on')?.totalCents),
    'V2V should use the lower factual video-input token rate'
  );
});

test('Seedance 2.5 presents pricing in customer-facing language', () => {
  const entry = getEngineEntry('seedance-2-5');
  const customerCopy = [entry.engine.pricing?.notes ?? '', entry.billingNote ?? ''];

  for (const copy of customerCopy) {
    assert.match(copy, /price is calculated before generation/i);
    assert.doesNotMatch(copy, /provider costs?|internal multipliers?|markup|output usage tokens?|2\.5x/i);
  }
  assert.equal(entry.pricingHint?.label, 'Price calculated before generation');
});

test('hidden direct Fast keeps the current Fast unit rate', () => {
  assert.equal(
    getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0-fast-byteplus', 'no_video_input', '720p'),
    getBytePlusUnitPriceUsdPer1kTokens('seedance-2-0-fast', 'no_video_input', '720p')
  );
});

test('BytePlus token estimation also fails closed for an unknown profile', () => {
  assert.throws(
    () =>
      expectedBytePlusTokens({
        engine_id: 'seedance-9-9',
        duration_sec: 5,
        settings_snapshot: {
          core: { resolution: '720p', aspectRatio: '16:9' },
        },
      }),
    (error: unknown) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code ===
        'BYTEPLUS_ENGINE_PROFILE_MISSING'
  );
});

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
