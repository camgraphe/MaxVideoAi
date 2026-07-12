import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines';
import { computePricingSnapshot } from '../frontend/src/lib/pricing';
import {
  computeCanonicalAudioBillingSnapshot,
  computeCanonicalBillingSnapshot,
} from '../frontend/server/pricing/quote-billing';
import { buildAudioPricingSnapshot, type AudioPricingInput } from '../frontend/src/lib/audio-generation';
import { repriceCanonicalFixedProductSnapshot } from '../frontend/src/lib/billing-products';
import type { PricingSnapshot } from '@maxvideoai/pricing';

const entriesById = new Map(listFalEngines().map((entry) => [entry.id, entry.engine]));

const scenarios = [
  {
    id: 'standard-video',
    context: {
      engine: entriesById.get('happy-horse-1-1'),
      durationSec: 5,
      resolution: '1080p',
      mode: 't2v',
      membershipTier: 'plus',
    },
  },
  {
    id: 'luma-reference-image',
    context: {
      engine: entriesById.get('luma-uni-1'),
      durationSec: 1,
      resolution: '1:1',
      mode: 't2i',
      referenceImageCount: 2,
      membershipTier: 'member',
    },
  },
  {
    id: 'luma-ray-3-2',
    context: {
      engine: entriesById.get('luma-ray-3-2'),
      durationSec: 5,
      durationOption: '5s',
      resolution: '720p',
      mode: 't2v',
      membershipTier: 'pro',
    },
  },
  {
    id: 'seedance-token',
    context: {
      engine: entriesById.get('seedance-2-0'),
      durationSec: 5,
      resolution: '720p',
      aspectRatio: '16:9',
      hasVideoInput: false,
      mode: 't2v',
      membershipTier: 'member',
    },
  },
  {
    id: 'gpt-image-2',
    context: {
      engine: entriesById.get('gpt-image-2'),
      durationSec: 2,
      resolution: '1024x1024',
      quality: 'high',
      mode: 't2i',
      membershipTier: 'plus',
    },
  },
  {
    id: 'standard-fractional-addon',
    context: {
      engine: entriesById.get('nano-banana-2'),
      durationSec: 1,
      resolution: '1k',
      mode: 't2i',
      addons: { enable_web_search: true },
      membershipTier: 'member',
    },
  },
  {
    id: 'luma-ray-2-generate',
    context: {
      engine: entriesById.get('lumaRay2'),
      durationSec: 9,
      durationOption: '9s',
      resolution: '1080p',
      mode: 't2v',
      membershipTier: 'plus',
    },
  },
  {
    id: 'luma-ray-2-edit',
    context: {
      engine: entriesById.get('lumaRay2_flash'),
      durationSec: 7,
      resolution: '720p',
      mode: 'v2v',
      membershipTier: 'pro',
    },
  },
] as const;

const financialFields = [
  'currency',
  'totalCents',
  'subtotalBeforeDiscountCents',
  'base',
  'addons',
  'margin',
  'discount',
  'membershipTier',
  'platformFeeCents',
  'vendorShareCents',
] as const;

function withoutCanonicalPolicy(snapshot: PricingSnapshot): PricingSnapshot {
  const meta = { ...(snapshot.meta ?? {}) };
  delete meta.pricingPolicy;
  return { ...snapshot, meta };
}

for (const scenario of scenarios) {
  test(`canonical billing preserves ${scenario.id} financial and provider snapshot fields`, async () => {
    assert.ok(scenario.context.engine, `missing engine for ${scenario.id}`);
    const context = scenario.context as Parameters<typeof computePricingSnapshot>[0];
    const expected = await computePricingSnapshot(context);
    const actual = await computeCanonicalBillingSnapshot(context);

    for (const field of financialFields) {
      assert.deepEqual(actual[field], expected[field], `${scenario.id}.${field}`);
    }
    assert.deepEqual(withoutCanonicalPolicy(actual).meta, expected.meta, `${scenario.id}.meta`);
    assert.deepEqual(actual.meta?.pricingPolicy, {
      source: 'versioned',
      matchedBy: 'global',
      sourceRuleId: 'default',
      compatibilityProfile:
        scenario.id === 'luma-reference-image' ||
        scenario.id === 'luma-ray-3-2' ||
        scenario.id === 'seedance-token'
          ? 'provider-reference-current'
          : 'standard',
    });
  });
}

test('charge-authoritative video and image call sites use the server-only canonical quote', () => {
  const chargedConsumers = [
    'frontend/app/api/generate/_lib/billing-preflight.ts',
    'frontend/app/api/wallet/route.ts',
    'frontend/src/server/images/execute-image-generation.ts',
    'frontend/src/server/images/storyboard-image-billing.ts',
  ];
  for (const path of chargedConsumers) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /quote-billing/, `${path} should import the canonical billing entry point`);
    assert.match(source, /computeCanonicalBillingSnapshot/, `${path} should calculate charged quotes canonically`);
  }

  const publicConsumers = [
    'frontend/src/server/engines.ts',
    'frontend/app/api/images/estimate/route.ts',
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-pricing.ts',
  ];
  for (const path of publicConsumers) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /quote-billing/, `${path} should wait for the public projection migration`);
  }
});

const audioScenarios: AudioPricingInput[] = [
  { pack: 'music_only', durationSec: 30, mood: 'epic', musicModel: 'clip', musicBpm: 110 },
  { pack: 'voice_only', durationSec: 20, voiceMode: 'clone', script: 'Short cloned narration.' },
  { pack: 'cinematic', durationSec: 3, mood: 'tense', musicEnabled: false },
  { pack: 'cinematic_voice', durationSec: 45, mood: 'documentary', script: 'A concise narrated scene.' },
];

for (const input of audioScenarios) {
  test(`canonical audio billing preserves ${input.pack} financial fields`, async () => {
    const expected = buildAudioPricingSnapshot(input);
    const actual = await computeCanonicalAudioBillingSnapshot(input);
    assert.equal(actual.currency, expected.currency);
    assert.equal(actual.totalCents, expected.totalCents);
    assert.equal(actual.subtotalBeforeDiscountCents, expected.subtotalBeforeDiscountCents);
    assert.deepEqual(actual.base, expected.base);
    assert.deepEqual(actual.addons, expected.addons);
    assert.equal(actual.margin.amountCents, expected.margin.amountCents);
    assert.equal(actual.margin.percentApplied, expected.margin.percentApplied);
    assert.equal(actual.margin.flatCents, expected.margin.flatCents);
    assert.equal(actual.platformFeeCents, expected.platformFeeCents);
    assert.equal(actual.vendorShareCents, expected.vendorShareCents);
    assert.deepEqual(withoutCanonicalPolicy(actual).meta, expected.meta);
    assert.equal(actual.meta?.pricingPolicy && typeof actual.meta.pricingPolicy, 'object');
  });
}

test('canonical fixed-product repricing preserves the current zero settlement split', () => {
  const repriced = repriceCanonicalFixedProductSnapshot(
    {
      currency: 'USD',
      totalCents: 25,
      subtotalBeforeDiscountCents: 25,
      base: { seconds: 1, rate: 0.25, unit: 'run', amountCents: 25 },
      addons: [],
      margin: { amountCents: 0, flatCents: 0 },
      membershipTier: 'member',
      platformFeeCents: 0,
      vendorShareCents: 0,
      meta: { billingProductKey: 'tool-demo', engineId: 'tool-demo' },
    },
    40,
    { pricingModel: 'dynamic-tool-demo', dynamicFloorCents: 25 }
  );

  assert.equal(repriced.totalCents, 40);
  assert.equal(repriced.base.amountCents, 40);
  assert.equal(repriced.platformFeeCents, 0);
  assert.equal(repriced.vendorShareCents, 0);
  assert.equal(repriced.meta?.pricingModel, 'dynamic-tool-demo');
});
