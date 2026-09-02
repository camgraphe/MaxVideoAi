import assert from 'node:assert/strict';
import test from 'node:test';

import { computePricingDefinitionFacts } from '@maxvideoai/pricing';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts.ts';
import { buildPricingAuditScenarios } from '../frontend/src/lib/pricing-audit/scenarios.ts';
import { buildCanonicalPricingFacts } from '../frontend/src/lib/pricing-audit/canonical-facts.ts';
import {
  P0_VIDEO_PRICING_SCENARIOS,
  type P0VideoPricingScenario,
} from '../frontend/src/lib/pricing-audit/p0-video-scenarios.ts';
import { buildPricingDefinition } from '../frontend/src/lib/pricing-definition.ts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts.ts';
import {
  projectPublicPricingSnapshot,
  quotePublicPricing,
} from '../frontend/src/lib/pricing-public-quote.ts';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing.ts';
import { validateGenerationMediaConstraints } from '../frontend/app/api/generate/_lib/generation-media-constraints.ts';
import type { EngineCaps } from '../frontend/types/engines.ts';

type Scenario = P0VideoPricingScenario & {
  expectedVendorSubtotalCents: number;
  expectedAddonCents?: number;
  expectedQuantity?: number;
};

const EXPECTED_FACTS_BY_SCENARIO = {
  'wan-3:t2v:6:480p': { expectedVendorSubtotalCents: 30 },
  'wan-3:t2v:6:720p': { expectedVendorSubtotalCents: 60 },
  'wan-3:t2v:6:1080p': { expectedVendorSubtotalCents: 120 },
  'wan-3-prime:t2v:6:480p': { expectedVendorSubtotalCents: 40.8 },
  'wan-3-prime:t2v:6:720p': { expectedVendorSubtotalCents: 84 },
  'wan-3-prime:t2v:6:1080p': { expectedVendorSubtotalCents: 168 },
  'ltx-2-5-fast:t2v:6:720p': { expectedVendorSubtotalCents: 54 },
  'ltx-2-5-fast:t2v:6:1080p': { expectedVendorSubtotalCents: 78 },
  'ltx-2-5-fast:t2v:6:1440p': { expectedVendorSubtotalCents: 114 },
  'ltx-2-5-fast:t2v:6:2160p': { expectedVendorSubtotalCents: 180 },
  'ltx-2-5-fast:i2v:6:720p': { expectedVendorSubtotalCents: 54 },
  'ltx-2-5-fast:a2v:6:1080p:audio9': { expectedVendorSubtotalCents: 117, expectedQuantity: 9 },
  'ltx-2-5-pro:t2v:6:720p': { expectedVendorSubtotalCents: 72 },
  'ltx-2-5-pro:t2v:6:1080p': { expectedVendorSubtotalCents: 102 },
  'ltx-2-5-pro:i2v:6:720p': { expectedVendorSubtotalCents: 72 },
  'ltx-2-5-pro:a2v:6:1080p:audio9': { expectedVendorSubtotalCents: 153, expectedQuantity: 9 },
  'grok-imagine-video-1-5:t2v:6:480p': { expectedVendorSubtotalCents: 48 },
  'grok-imagine-video-1-5:t2v:6:720p': { expectedVendorSubtotalCents: 84 },
  'grok-imagine-video-1-5:t2v:6:1080p': { expectedVendorSubtotalCents: 150 },
  'grok-imagine-video-1-5:i2v:6:720p': { expectedVendorSubtotalCents: 84 },
  'grok-imagine-video-1-5:ref2v:6:480p:refs1': { expectedVendorSubtotalCents: 49, expectedAddonCents: 1 },
  'grok-imagine-video-1-5:ref2v:6:720p:refs3': { expectedVendorSubtotalCents: 87, expectedAddonCents: 3 },
  'flux-3:t2v:6:720p': { expectedVendorSubtotalCents: 102 },
  'flux-3:t2v:6:1080p': { expectedVendorSubtotalCents: 174 },
  'flux-3:i2v:6:720p': { expectedVendorSubtotalCents: 102 },
  'flux-3:fl2v:6:720p': { expectedVendorSubtotalCents: 102 },
  'flux-3:extend:6:720p': { expectedVendorSubtotalCents: 246 },
  'flux-3:extend:6:1080p': { expectedVendorSubtotalCents: 318 },
  'flux-3-draft:t2v:6:720p': { expectedVendorSubtotalCents: 36 },
  'flux-3-draft:i2v:6:720p': { expectedVendorSubtotalCents: 36 },
  'flux-3-draft:fl2v:6:720p': { expectedVendorSubtotalCents: 36 },
  'flux-3-draft:extend:6:720p': { expectedVendorSubtotalCents: 72 },
} as const satisfies Record<(typeof P0_VIDEO_PRICING_SCENARIOS)[number]['id'], {
  expectedVendorSubtotalCents: number;
  expectedAddonCents?: number;
  expectedQuantity?: number;
}>;

const manifest = {
  version: 1,
  currency: 'USD',
  scenarios: P0_VIDEO_PRICING_SCENARIOS.map((scenario) => ({
    ...scenario,
    ...EXPECTED_FACTS_BY_SCENARIO[scenario.id],
  })) as Scenario[],
};

const entries = new Map(listFalEngines().map((entry) => [entry.id, entry]));

function engineFor(id: string): EngineCaps {
  const engine = entries.get(id)?.engine;
  assert.ok(engine, `Missing P0 engine ${id}`);
  return engine;
}

function factsInput(scenario: Scenario) {
  return {
    durationSec: scenario.durationSec,
    resolution: scenario.resolution,
    mode: scenario.mode,
    referenceImageCount: scenario.referenceImageCount,
    inputAudioDurationSec: scenario.inputAudioDurationSec,
  };
}

test('freezes one common six-second 720p scenario for every P0 identity', () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.currency, 'USD');
  assert.deepEqual(
    manifest.scenarios.filter((scenario) => scenario.common720).map((scenario) => scenario.engineId),
    [
      'wan-3',
      'wan-3-prime',
      'ltx-2-5-fast',
      'ltx-2-5-pro',
      'grok-imagine-video-1-5',
      'flux-3',
      'flux-3-draft',
    ],
  );
});

test('projects literal P0 mode, tier, input-audio duration, and reference pricing facts', () => {
  for (const scenario of manifest.scenarios) {
    const definition = buildPricingDefinition(engineFor(scenario.engineId));
    assert.ok(definition, scenario.id);
    const facts = computePricingDefinitionFacts(definition, factsInput(scenario) as never);
    assert.equal(
      facts.vendorSubtotalExactCents,
      scenario.expectedVendorSubtotalCents,
      `${scenario.id} vendor subtotal`,
    );
    assert.equal(
      facts.base.seconds,
      scenario.expectedQuantity ?? scenario.durationSec,
      `${scenario.id} billable quantity`,
    );
    assert.equal(
      facts.addons.reduce((sum, addon) => sum + addon.amountCents, 0),
      scenario.expectedAddonCents ?? 0,
      `${scenario.id} factual addons`,
    );
  }
});

test('billing and browser-safe public facts remain identical for every frozen P0 scenario', () => {
  for (const scenario of manifest.scenarios) {
    const engine = engineFor(scenario.engineId);
    const context = { engine, ...factsInput(scenario) };
    const billing = buildBillingPricingFacts(context as never, engine.pricingDetails, 'USD');
    const publicFacts = buildPublicPricingFacts(context as never);
    assert.equal(billing.facts.vendorSubtotalExactCents, scenario.expectedVendorSubtotalCents, scenario.id);
    assert.equal(publicFacts.facts.vendorSubtotalExactCents, billing.facts.vendorSubtotalExactCents, scenario.id);
    assert.deepEqual(publicFacts.base, billing.base, scenario.id);
    assert.deepEqual(publicFacts.addons, billing.addons, scenario.id);
  }
});

test('billing and browser-safe public quotes remain identical for every frozen P0 scenario', async () => {
  for (const scenario of manifest.scenarios) {
    const engine = engineFor(scenario.engineId);
    const context = {
      engine,
      ...factsInput(scenario),
      membershipTier: 'member' as const,
    };
    const billing = await computeCanonicalBillingSnapshot(context as never, {
      pricingPolicy: {
        loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }),
        warn: () => undefined,
      },
      membershipDiscounts: { member: 0, plus: 0.05, pro: 0.1 },
    });
    const publicFacts = buildPublicPricingFacts(context as never);
    const publicQuote = quotePublicPricing({
      facts: publicFacts.facts,
      scenario: {
        id: `public:p0:${scenario.id}`,
        engineId: scenario.engineId,
        mode: scenario.mode,
        resolution: scenario.resolution,
        membershipTier: 'member',
      },
      compatibilityProfileId: publicFacts.compatibilityProfileId,
    });
    const publicSnapshot = projectPublicPricingSnapshot({
      quote: publicQuote,
      base: publicFacts.base,
      addons: publicFacts.addons,
      meta: publicFacts.meta,
    });

    assert.equal(publicQuote.breakdown.vendorSubtotalExactCents, scenario.expectedVendorSubtotalCents, scenario.id);
    for (const field of [
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
    ] as const) {
      assert.deepEqual(publicSnapshot[field], billing[field], `${scenario.id}.${field}`);
    }
  }
});

test('every frozen P0 scenario is projected into the canonical pricing audit', () => {
  const auditById = new Map(buildPricingAuditScenarios().map((scenario) => [scenario.id, scenario]));
  for (const expected of manifest.scenarios) {
    const scenario = auditById.get(`billing:p0:${expected.id}`);
    assert.ok(scenario, expected.id);
    const facts = buildCanonicalPricingFacts(scenario);
    assert.ok(facts, expected.id);
    assert.equal(facts.vendorSubtotalExactCents, expected.expectedVendorSubtotalCents, expected.id);
    assert.equal(facts.quantity, expected.expectedQuantity ?? expected.durationSec, expected.id);
  }
});

test('Wan Prime keeps fractional-cent factual precision through multiplication', () => {
  const scenario = manifest.scenarios.find((candidate) => candidate.id === 'wan-3-prime:t2v:6:480p');
  assert.ok(scenario);
  const definition = buildPricingDefinition(engineFor(scenario.engineId));
  assert.ok(definition);
  const facts = computePricingDefinitionFacts(definition, factsInput(scenario) as never);
  assert.equal(facts.base.rate, 0.068);
  assert.equal(facts.base.amountCents, 40.8);
  assert.equal(facts.vendorSubtotalExactCents, 40.8);
});

test('Grok reference pricing applies only to ref2v and has no invented free reference', () => {
  const engine = engineFor('grok-imagine-video-1-5');
  const definition = buildPricingDefinition(engine);
  assert.ok(definition);

  const textFacts = computePricingDefinitionFacts(definition, {
    durationSec: 6,
    resolution: '720p',
    mode: 't2v',
    referenceImageCount: 3,
  } as never);
  assert.equal(textFacts.vendorSubtotalExactCents, 84);
  assert.deepEqual(textFacts.addons, []);

  const referenceFacts = computePricingDefinitionFacts(definition, {
    durationSec: 6,
    resolution: '720p',
    mode: 'ref2v',
    referenceImageCount: 1,
  } as never);
  assert.equal(referenceFacts.vendorSubtotalExactCents, 85);
  assert.deepEqual(referenceFacts.addons, [{ type: 'reference_images', amountCents: 1 }]);
});

test('Grok reference pricing rejects missing or invalid reference facts', () => {
  const definition = buildPricingDefinition(engineFor('grok-imagine-video-1-5'));
  assert.ok(definition);

  for (const referenceImageCount of [undefined, -1, 0, 1.5, Number.NaN]) {
    assert.throws(
      () => computePricingDefinitionFacts(definition, {
        durationSec: 6,
        resolution: '720p',
        mode: 'ref2v',
        ...(referenceImageCount === undefined ? {} : { referenceImageCount }),
      } as never),
      /reference image count/i,
      String(referenceImageCount),
    );
  }

  const zeroPermittedDefinition = {
    ...definition,
    referenceImages: {
      ...definition.referenceImages!,
      minimumCount: 0,
    },
  };
  const zeroFacts = computePricingDefinitionFacts(zeroPermittedDefinition, {
    durationSec: 6,
    resolution: '720p',
    mode: 'ref2v',
    referenceImageCount: 0,
  });
  assert.deepEqual(zeroFacts.addons, []);
});

test('LTX audio-to-video fails closed without explicit input-audio duration', () => {
  for (const engineId of ['ltx-2-5-fast', 'ltx-2-5-pro']) {
    const definition = buildPricingDefinition(engineFor(engineId));
    assert.ok(definition);
    assert.throws(
      () => computePricingDefinitionFacts(definition, {
        durationSec: 6,
        resolution: '1080p',
        mode: 'a2v',
      } as never),
      /input[-_ ]audio duration/i,
      engineId,
    );
  }
});

test('mode-specific definition projection is data-driven and contains no P0 calculator', () => {
  const ltx = buildPricingDefinition(engineFor('ltx-2-5-fast')) as unknown as Record<string, unknown>;
  const grok = buildPricingDefinition(engineFor('grok-imagine-video-1-5')) as unknown as Record<string, unknown>;
  const flux = buildPricingDefinition(engineFor('flux-3')) as unknown as Record<string, unknown>;

  assert.deepEqual((ltx.modePricing as Record<string, unknown>)?.a2v, {
    perSecondCents: { default: 13, byResolution: { '1080p': 13 } },
    durationBasis: 'input_audio',
  });
  assert.deepEqual(grok.referenceImages, { unitCents: 1, minimumCount: 1, modes: ['ref2v'] });
  assert.deepEqual((flux.modePricing as Record<string, unknown>)?.extend, {
    perSecondCents: { byResolution: { '720p': 41, '1080p': 53 } },
  });
});

test('site media validation returns trusted LTX input-audio duration for billing', async () => {
  const ltx = engineFor('ltx-2-5-fast');
  const url = 'https://media.maxvideo.ai/private/source.wav';
  const result = await validateGenerationMediaConstraints({
    engineId: ltx.id,
    mode: 'a2v',
    userId: 'pricing-user',
    inputSchema: ltx.inputSchema,
    attachments: [{
      name: 'source.wav',
      type: 'audio/wav',
      size: 2_048,
      kind: 'audio',
      slotId: 'audio_url',
      url,
      assetId: 'audio-asset',
      durationSec: 99,
    }],
    referenceMediaItems: [{ fieldId: 'audio_url', kind: 'audio', url }],
    deps: {
      queryFn: async () => [{
        asset_id: 'audio-asset',
        url,
        origin_url: null,
        original_name: 'source.wav',
        mime_type: 'audio/wav',
        size_bytes: 2_048,
        duration_sec: 9.25,
        width: null,
        height: null,
      }],
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.trustedDurationSecByField, { audio_url: [9.25] });
});
