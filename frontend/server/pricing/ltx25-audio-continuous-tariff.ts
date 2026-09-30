import type { ManualTariffPrice, PricingCompatibilityProfile, ResolvedPricingPolicy } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { validateLtx25AudioTariffDuration } from '@/lib/ltx25-audio-tariff';
import { validateMonotoneContinuousTariffDomain } from './continuous-tariff-domain';

/** Migration-only: persist absolute audio-second amounts; no live vendor or percentage lookup. */
export function compileLtx25AudioContinuousTariffPrice(input: {
  context: PricingContext; policy: ResolvedPricingPolicy; compatibilityProfile: PricingCompatibilityProfile;
}): ManualTariffPrice {
  const { context, policy, compatibilityProfile: profile } = input;
  validateLtx25AudioTariffDuration(context.engine.id, context.mode ?? '', context.inputAudioDurationSec ?? NaN);
  if (policy.rule.currency !== 'USD' || profile.vendorSubtotalRounding !== 'preserve' || profile.subtotalRounding
    || (profile.discountPercentOverride ?? 0) !== 0 || profile.vendorShareMode === 'zero'
    || !['up', 'nearest'].includes(profile.marginRounding) || !['up', 'nearest'].includes(profile.totalRounding)) {
    throw new Error('Unsupported LTX audio price profile; explicit review is required.');
  }
  const amounts = buildBillingPricingFacts({ ...context, inputAudioDurationSec: 1 }, context.engine.pricingDetails, 'USD');
  const rate = amounts.base.rate * 100;
  const margin = profile.marginPercentOverride ?? policy.rule.marginPercent;
  const flat = profile.marginFlatCentsOverride ?? policy.rule.marginFlatCents;
  if (amounts.meta.durationBasis !== 'input_audio' || amounts.addons.length || amounts.facts.vendorSubtotalExactCents !== rate
    || !Number.isFinite(rate) || rate <= 0 || ![margin, flat].every(value => Number.isFinite(value) && value >= 0)) {
    throw new Error('Unsupported effective LTX audio amounts.');
  }
  const quantityRounding = { scale: rate, precision: 3 };
  return { kind: 'unit_components', rounding: profile.totalRounding as 'up' | 'nearest', components: [
    { id: 'base', flatCents: 0, precision: 3, rounding: 'none', terms: [
      { unit: 'input_audio_seconds', centsPerUnit: rate, quantityRounding },
    ] },
    { id: 'rounding-adjustment', flatCents: flat, rounding: profile.marginRounding as 'up' | 'nearest', terms: [
      { unit: 'input_audio_seconds', centsPerUnit: rate * margin, quantityRounding },
    ] },
  ] };
}

export function validateLtx25AudioContinuousTariffDomain(input: { context: PricingContext; price: ManualTariffPrice }) {
  const { context, price } = input;
  const bounds = validateLtx25AudioTariffDuration(context.engine.id, context.mode ?? '', context.inputAudioDurationSec ?? NaN);
  const factsAt = (seconds: number) => buildBillingPricingFacts({ ...context, inputAudioDurationSec: seconds }, context.engine.pricingDetails, 'USD').facts;
  const selector = continuousInputTariffSelector(buildManualTariffScenario(context, factsAt(context.inputAudioDurationSec!)).selector);
  if (!selector) throw new Error('Unsupported continuous audio tariff.');
  return validateMonotoneContinuousTariffDomain({ price, selector, unit: 'input_audio_seconds',
    minimum: bounds.min, maximum: bounds.max, factsAt });
}
