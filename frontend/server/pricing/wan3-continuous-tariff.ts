import type { ManualTariffPrice, PricingCompatibilityProfile, ResolvedPricingPolicy } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { isWan3EngineId, validateWan3PricingDuration } from '@/lib/wan3-pricing';

/** Migration-only compiler. The persisted result contains absolute amounts, never a live percentage rule. */
export function compileWan3ContinuousTariffPrice(input: {
  context: PricingContext;
  policy: ResolvedPricingPolicy;
  compatibilityProfile: PricingCompatibilityProfile;
}): ManualTariffPrice {
  const { context, policy, compatibilityProfile: profile } = input;
  if (!isWan3EngineId(context.engine.id) || !['v2v', 'extend'].includes(context.mode ?? '') ||
      policy.rule.currency !== 'USD' || profile.vendorSubtotalRounding !== 'preserve' || profile.subtotalRounding ||
      (profile.discountPercentOverride ?? 0) !== 0 || profile.vendorShareMode === 'zero' ||
      !['up', 'nearest'].includes(profile.marginRounding) || !['up', 'nearest'].includes(profile.totalRounding)) {
    throw new Error('Unsupported Wan continuous tariff profile; explicit review is required.');
  }
  validateWan3PricingDuration(context);
  const margin = profile.marginPercentOverride ?? policy.rule.marginPercent;
  const flat = profile.marginFlatCentsOverride ?? policy.rule.marginFlatCents;
  if (![margin, flat].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Unsupported effective Wan amounts.');
  // A positive subnormal source satisfies the media contract and has zero rounded input amount.
  const output = buildBillingPricingFacts({ ...context, inputVideoDurationSec: Number.MIN_VALUE }, context.engine.pricingDetails, 'USD');
  const sourceRateCents = output.base.rate * 100;
  if (!Number.isFinite(sourceRateCents) || sourceRateCents <= 0) throw new Error('Unsupported Wan input rate.');
  const outputCents = output.facts.vendorSubtotalExactCents;
  const quantityRounding = { scale: sourceRateCents, precision: 3 };
  return {
    kind: 'unit_components', rounding: profile.totalRounding as 'up' | 'nearest', components: [
      { id: 'base', flatCents: outputCents, precision: 3, rounding: 'none', terms: [
        { unit: 'input_video_seconds', centsPerUnit: sourceRateCents, quantityRounding },
      ] },
      { id: 'rounding-adjustment', flatCents: outputCents * margin + flat,
        rounding: profile.marginRounding as 'up' | 'nearest', terms: [
          { unit: 'input_video_seconds', centsPerUnit: sourceRateCents * margin, quantityRounding },
        ] },
    ],
  };
}
