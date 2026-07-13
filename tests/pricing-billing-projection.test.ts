import assert from 'node:assert/strict';
import test from 'node:test';

import {
  projectCanonicalQuoteToSnapshot,
  quoteCanonicalPricing,
  type PricingCompatibilityProfile,
  type ResolvedPricingPolicy,
} from '@maxvideoai/pricing';
import * as pricingPackage from '@maxvideoai/pricing';

const resolvedPolicy: ResolvedPricingPolicy = {
  rule: {
    id: 'demo-rule',
    engineId: 'demo',
    marginPercent: 0.3,
    marginFlatCents: 0,
    surchargeAudioPercent: 0.2,
    surchargeUpscalePercent: 0.5,
    currency: 'USD',
  },
  source: 'versioned',
  matchedBy: 'engine',
  sourceRuleId: 'demo-rule',
};

const standardProfile: PricingCompatibilityProfile = {
  id: 'standard',
  vendorSubtotalRounding: 'preserve',
  marginRounding: 'up',
  surchargeRounding: 'up',
  discountRounding: 'nearest',
  totalRounding: 'nearest',
};

test('canonical quote projects the existing billing snapshot financial contract', () => {
  const quote = quoteCanonicalPricing({
    facts: {
      engineId: 'demo',
      currency: 'USD',
      vendorSubtotalExactCents: 42.5,
      unit: 'sec',
      quantity: 5,
    },
    scenario: {
      id: 'demo',
      engineId: 'demo',
      membershipTier: 'plus',
      discountPercent: 0.05,
    },
    policy: resolvedPolicy,
    compatibilityProfile: standardProfile,
  });
  const snapshot = projectCanonicalQuoteToSnapshot({
    quote,
    base: { seconds: 5, rate: 0.085, unit: 'sec', amountCents: 42.5 },
    addons: [],
    vendorAccountId: 'acct_demo',
    meta: { provider: 'demo' },
  });

  assert.equal(snapshot.totalCents, quote.customerTotalCents);
  assert.equal(snapshot.subtotalBeforeDiscountCents, quote.subtotalBeforeDiscountCents);
  assert.equal(snapshot.platformFeeCents, quote.platformFeeCents);
  assert.equal(snapshot.vendorShareCents, quote.vendorShareCents);
  assert.equal(snapshot.margin.ruleId, quote.policyProvenance.sourceRuleId);
  assert.equal(snapshot.vendorAccountId, 'acct_demo');
  assert.deepEqual(snapshot.meta, {
    provider: 'demo',
    pricingPolicy: {
      source: 'versioned',
      matchedBy: 'engine',
      sourceRuleId: 'demo-rule',
      compatibilityProfile: 'standard',
    },
  });
});

test('canonical snapshot projection rejects invalid provider presentation facts', () => {
  const quote = quoteCanonicalPricing({
    facts: {
      engineId: 'demo',
      currency: 'USD',
      vendorSubtotalExactCents: 10,
      unit: 'sec',
      quantity: 1,
    },
    scenario: {
      id: 'demo-invalid-projection',
      engineId: 'demo',
      membershipTier: 'member',
      discountPercent: 0,
    },
    policy: resolvedPolicy,
    compatibilityProfile: standardProfile,
  });

  assert.throws(
    () =>
      projectCanonicalQuoteToSnapshot({
        quote,
        base: { seconds: 1, rate: 0.1, unit: 'sec', amountCents: Number.NaN },
        addons: [],
      }),
    /base\.amountCents/
  );
  assert.throws(
    () =>
      projectCanonicalQuoteToSnapshot({
        quote,
        base: { seconds: 1, rate: 0.1, unit: 'sec', amountCents: 10 },
        addons: [{ type: 'audio', amountCents: -1 }],
      }),
    /addons\[0\]\.amountCents/
  );
});

test('canonical snapshot projection accepts a bounded provider audio-off adjustment', () => {
  const quote = quoteCanonicalPricing({
    facts: {
      engineId: 'demo',
      currency: 'USD',
      vendorSubtotalExactCents: 35,
      unit: 'sec',
      quantity: 5,
    },
    scenario: {
      id: 'demo-audio-off',
      engineId: 'demo',
      membershipTier: 'member',
      discountPercent: 0,
    },
    policy: resolvedPolicy,
    compatibilityProfile: standardProfile,
  });
  const snapshot = projectCanonicalQuoteToSnapshot({
    quote,
    base: { seconds: 5, rate: 0.14, unit: 'sec', amountCents: 70 },
    addons: [{ type: 'audio_off', amountCents: -35 }],
  });

  assert.equal(snapshot.addons[0]?.amountCents, -35);
  assert.equal(snapshot.base.amountCents + snapshot.addons[0]!.amountCents, 35);
});

test('pricing package owns settlement projections for current and historical snapshots', () => {
  const helpers = pricingPackage as typeof pricingPackage & {
    getPlatformFeeCents?: (snapshot: { totalCents: number; margin?: { amountCents?: number }; discount?: { amountCents?: number }; platformFeeCents?: number }) => number;
    getVendorShareCents?: (snapshot: { totalCents: number; margin?: { amountCents?: number }; discount?: { amountCents?: number }; platformFeeCents?: number; vendorShareCents?: number }) => number;
  };

  assert.equal(typeof helpers.getPlatformFeeCents, 'function');
  assert.equal(typeof helpers.getVendorShareCents, 'function');
  assert.equal(helpers.getPlatformFeeCents?.({ totalCents: 130, platformFeeCents: 30 }), 30);
  assert.equal(
    helpers.getPlatformFeeCents?.({ totalCents: 115, margin: { amountCents: 30 }, discount: { amountCents: 15 } }),
    15
  );
  assert.equal(helpers.getVendorShareCents?.({ totalCents: 115, vendorShareCents: 100 }), 100);
  assert.equal(
    helpers.getVendorShareCents?.({ totalCents: 115, margin: { amountCents: 30 }, discount: { amountCents: 15 } }),
    100
  );
});

test('pricing package exposes provider facts from standard definitions without commercial policy', () => {
  const factsApi = pricingPackage as typeof pricingPackage & {
    computePricingDefinitionFacts?: (
      definition: Record<string, unknown>,
      input: Record<string, unknown>
    ) => {
      vendorSubtotalExactCents: number;
      base: { amountCents: number };
      addons: Array<{ type: string; amountCents: number }>;
    };
  };
  assert.equal(typeof factsApi.computePricingDefinitionFacts, 'function');
  const facts = factsApi.computePricingDefinitionFacts?.(
    {
      engineId: 'facts-demo',
      currency: 'USD',
      baseUnitPriceCents: 10,
      durationSteps: { min: 1, max: 10, step: 1 },
      resolutionMultipliers: { '1080p': 2 },
      memberTierDiscounts: { member: 0, plus: 0.05, pro: 0.1 },
      addons: { audio: { flatCents: 5 } },
      platformFeePct: 99,
    },
    { engineId: 'facts-demo', durationSec: 3, resolution: '1080p', addons: { audio: true } }
  );
  assert.deepEqual(facts, {
    vendorSubtotalExactCents: 65,
    base: { seconds: 3, rate: 0.2, unit: 'sec', amountCents: 60 },
    addons: [{ type: 'audio', amountCents: 5 }],
    meta: {
      taxPolicyHint: undefined,
      resolutionMultiplier: 2,
      durationSteps: { min: 1, max: 10, step: 1 },
      availability: undefined,
      baseUnitPriceCents: 10,
    },
  });
});

test('server storyboard quote uses the specific database rule and preserves provider routing', async () => {
  const { computeCanonicalStoryboardBillingSnapshot } = await import(
    '../frontend/server/pricing/quote-billing.ts'
  );
  const snapshot = await computeCanonicalStoryboardBillingSnapshot(
    {
      snapshot: {
        currency: 'USD',
        totalCents: 13,
        subtotalBeforeDiscountCents: 13,
        base: { seconds: 1, rate: 0.1, unit: 'image', amountCents: 10 },
        addons: [],
        margin: { amountCents: 3, percentApplied: 0.3, flatCents: 0 },
        membershipTier: 'member',
        platformFeeCents: 3,
        vendorShareCents: 10,
        vendorAccountId: 'acct_gpt_image',
      },
      operation: 'storyboard',
      tier: 'hd',
    },
    {
      pricingPolicy: {
        loadOverrides: async () => ({
          status: 'loaded',
          rules: [
            {
              id: 'database-default',
              marginPercent: 0.3,
              marginFlatCents: 0,
              surchargeAudioPercent: 0.2,
              surchargeUpscalePercent: 0.5,
              currency: 'USD',
            },
            {
              id: 'storyboard-generate',
              engineId: 'storyboarder',
              mode: 'storyboard',
              marginPercent: 2,
              marginFlatCents: 0,
              surchargeAudioPercent: 0.2,
              surchargeUpscalePercent: 0.5,
              currency: 'USD',
            },
          ],
        }),
      },
    }
  );

  assert.equal(snapshot.totalCents, 30);
  assert.equal(snapshot.margin.amountCents, 20);
  assert.equal(snapshot.vendorShareCents, 10);
  assert.equal(snapshot.vendorAccountId, 'acct_gpt_image');
  assert.deepEqual(snapshot.meta?.pricingPolicy, {
    source: 'database',
    matchedBy: 'precise',
    sourceRuleId: 'storyboard-generate',
    compatibilityProfile: 'standard',
  });
});
