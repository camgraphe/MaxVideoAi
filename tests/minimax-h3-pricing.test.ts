import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveGenerateBillingPreflight } from '../frontend/app/api/generate/_lib/billing-preflight';
import { MINIMAX_H3_ENGINE } from '../frontend/src/config/fal-engines/minimax-h3';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildPublicPricingFacts } from '../frontend/src/lib/pricing-public-facts';
import { calculateMinimaxH3ProviderPrice } from '../frontend/src/lib/minimax-h3-pricing';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import type { PricingContext } from '../frontend/src/lib/pricing-context';
import type { PricingSnapshot } from '../frontend/types/engines';

test('MiniMax H3 provider calculator prices resolution, duration, and paid references exactly', () => {
  assert.equal(calculateMinimaxH3ProviderPrice({ durationSec: 5, resolution: '768P', referenceImageCount: 0 }).subtotalUsd, 0.4);
  assert.equal(calculateMinimaxH3ProviderPrice({ durationSec: 15, resolution: '2K', referenceImageCount: 5 }).subtotalUsd, 1.95);
  assert.equal(calculateMinimaxH3ProviderPrice({ durationSec: 15, resolution: '2K', referenceImageCount: 6 }).subtotalUsd, 2.03);
  const flagship = calculateMinimaxH3ProviderPrice({ durationSec: 15, resolution: '4K', referenceImageCount: 9 });
  assert.equal(flagship.subtotalUsd, 2.72);
  assert.deepEqual(flagship.breakdown, {
    durationSec: 15,
    resolution: '4K',
    ratePerSecondUsd: 0.16,
    baseSubtotalUsd: 2.4,
    referenceImageCount: 9,
    includedReferenceImages: 5,
    paidReferenceImages: 4,
    referenceImageSurchargeUsd: 0.32,
  });
});

test('MiniMax H3 billing and public factual projections include the same sixth-image surcharge', () => {
  const context: PricingContext = {
    engine: MINIMAX_H3_ENGINE,
    durationSec: 15,
    resolution: '2K',
    mode: 'ref2v',
    referenceImageCount: 6,
    membershipTier: 'member',
  };
  const billing = buildBillingPricingFacts(context, MINIMAX_H3_ENGINE.pricingDetails, 'USD');
  const publicFacts = buildPublicPricingFacts(context);

  assert.equal(billing.facts.vendorSubtotalExactCents, 203);
  assert.equal(publicFacts.facts.vendorSubtotalExactCents, 203);
  assert.equal(billing.compatibilityProfileId, 'provider-reference-current');
  assert.equal(publicFacts.compatibilityProfileId, 'provider-reference-current');
  assert.deepEqual(billing.meta.cost_breakdown_usd, publicFacts.meta.cost_breakdown_usd);
  assert.deepEqual(billing.addons, [{ type: 'reference_images_above_five', amountCents: 8 }]);
  assert.deepEqual(publicFacts.addons, [{ type: 'reference_images_above_five', amountCents: 8 }]);
});

test('MiniMax H3 canonical billing and public snapshots stay identical by mode and member tier', async () => {
  for (const mode of ['t2v', 'i2v', 'ref2v'] as const) {
    for (const membershipTier of ['member', 'plus', 'pro'] as const) {
      const context: PricingContext = {
        engine: MINIMAX_H3_ENGINE,
        durationSec: 15,
        resolution: '4K',
        mode,
        referenceImageCount: mode === 'ref2v' ? 6 : 0,
        membershipTier,
      };
      const billing = await computeCanonicalBillingSnapshot(context, {
        pricingPolicy: {
          loadOverrides: async () => ({ status: 'loaded', rules: [], routingRules: [] }),
          warn: () => undefined,
        },
      });
      const publicSnapshot = await computeCanonicalPublicSnapshot(context);
      for (const field of [
        'currency', 'totalCents', 'subtotalBeforeDiscountCents', 'base', 'addons',
        'margin', 'discount', 'membershipTier', 'platformFeeCents', 'vendorShareCents',
      ] as const) {
        assert.deepEqual(billing[field], publicSnapshot[field], `${mode}.${membershipTier}.${field}`);
      }
      assert.equal((billing.meta?.cost_breakdown_usd as { referenceImageCount?: number }).referenceImageCount, mode === 'ref2v' ? 6 : 0);
    }
  }
});

test('generation billing preflight forwards and records the normalized H3 reference-image count', async () => {
  let capturedContext: PricingContext | null = null;
  const pricing: PricingSnapshot = {
    currency: 'USD',
    totalCents: 264,
    subtotalBeforeDiscountCents: 264,
    base: { seconds: 15, rate: 0.13, unit: 'sec', amountCents: 195 },
    addons: [{ type: 'reference_images_above_five', amountCents: 8 }],
    margin: { amountCents: 61 },
    membershipTier: 'member',
    platformFeeCents: 61,
    vendorShareCents: 203,
    meta: {
      cost_breakdown_usd: calculateMinimaxH3ProviderPrice({
        durationSec: 15,
        resolution: '2K',
        referenceImageCount: 6,
      }).breakdown,
    },
  };
  const result = await resolveGenerateBillingPreflight({
    req: { headers: { get: () => 'US' } } as never,
    engine: MINIMAX_H3_ENGINE,
    mode: 'ref2v',
    userId: 'user-h3',
    payment: { mode: 'wallet', paymentIntentId: null },
    jobId: 'job-h3',
    durationSec: 15,
    durationLabel: '15s',
    pricingResolution: '2K',
    effectiveResolution: '2K',
    aspectRatio: 'auto',
    membershipTier: 'member',
    isLumaRay2: false,
    loop: false,
    hasVideoInput: true,
    referenceImageCount: 6,
    rawDurationOption: 15,
    lumaDurationLabel: null,
    audioEnabled: undefined,
    voiceControl: false,
    deps: {
      getUserPreferredCurrencyFn: async () => 'usd',
      resolveCurrencyFn: () => ({ currency: 'usd', source: 'user_pref' }),
      applyEngineVariantPricingFn: (engine) => engine,
      buildEngineAddonInputFn: () => ({}),
      computePricingSnapshotFn: async (context) => {
        capturedContext = context;
        return { ...pricing, meta: { ...pricing.meta } };
      },
      convertCentsFn: async (cents) => ({ cents, rate: 1, source: 'identity' }),
      receiptsPriceOnlyEnabledFn: () => false,
      getPlatformFeeCentsFn: () => 61,
    },
  });

  assert.equal(result.ok, true);
  assert.equal(capturedContext?.referenceImageCount, 6);
  if (!result.ok) return;
  assert.equal(
    (result.preflight.pricing.meta?.request as { referenceImageCount?: number }).referenceImageCount,
    6
  );
  assert.equal(
    (result.preflight.receiptSnapshot.meta?.cost_breakdown_usd as { referenceImageCount?: number }).referenceImageCount,
    6
  );
});
