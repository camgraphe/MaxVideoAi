import { quoteCanonicalPricing, type ManualTariffPrice, type PricingCompatibilityProfile, type ResolvedPricingPolicy } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { isWan3EngineId, validateWan3PricingDuration } from '@/lib/wan3-pricing';
import { compileBoundedUnitBands } from './compile-bounded-unit-bands';
import { maximumWan3TariffSourceDuration } from './wan3-continuous-tariff-bounds';

/** Migration-only: capture actual source-second cent boundaries without reordering old rounding. */
export function compileWan3ContinuousTariffPrice(input: {
  context: PricingContext;
  policy: ResolvedPricingPolicy;
  compatibilityProfile: PricingCompatibilityProfile;
}): ManualTariffPrice {
  const { context, policy, compatibilityProfile: profile } = input;
  if (!isWan3EngineId(context.engine.id) || !['ref2v', 'v2v', 'extend'].includes(context.mode ?? '') ||
      policy.rule.currency !== 'USD' || profile.vendorSubtotalRounding !== 'preserve' || profile.subtotalRounding ||
      (profile.discountPercentOverride ?? 0) !== 0 || profile.vendorShareMode === 'zero' ||
      !['up', 'nearest'].includes(profile.marginRounding) || !['up', 'nearest'].includes(profile.totalRounding)) {
    throw new Error('Unsupported Wan continuous tariff profile; explicit review is required.');
  }
  validateWan3PricingDuration(context);
  return compileBoundedUnitBands({ terms: [{ unit: 'input_video_seconds', centsPerUnit: 1 }], divisor: 1,
    maxUnits: maximumWan3TariffSourceDuration(context.durationSec),
    currentCents: seconds => {
      // The zero endpoint is a virtual output-only baseline for required-video modes.
      const source = context.mode === 'ref2v' ? seconds : Math.max(Number.MIN_VALUE, seconds);
      const facts = buildBillingPricingFacts({ ...context, inputVideoDurationSec: source, hasVideoInput: source > 0 },
        context.engine.pricingDetails, 'USD').facts;
      return quoteCanonicalPricing({ facts, scenario: { id: 'compile-wan', engineId: context.engine.id,
        membershipTier: 'member', discountPercent: 0 }, policy, compatibilityProfile: profile }).customerTotalCents;
    },
  });
}
