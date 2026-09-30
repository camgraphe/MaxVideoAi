import type { ManualTariffPrice } from '@maxvideoai/pricing';
import { maximumWan3TariffSourceDuration } from './wan3-continuous-tariff-bounds';
import { validateMonotoneContinuousTariffDomain } from './continuous-tariff-domain';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousWan3TariffSelector } from '@/lib/pricing-manual-scenario';
import type { PricingContext } from '@/lib/pricing-context';
import { validateWan3PricingDuration } from '@/lib/wan3-pricing';

/**
 * Both authored nonnegative components and Wan supplier facts are monotone in input seconds.
 * Supplier ceil cents are constant between their jumps: the least customer price in each
 * interval is its first representable duration. Checking those points covers the whole range.
 */
export function validateWan3ContinuousTariffDomain(input: { context: PricingContext; price: ManualTariffPrice }): {
  maxInputSeconds: number; checkedBoundaries: number; minimumGrossCents: number;
} {
  validateWan3PricingDuration(input.context);
  const maxInputSeconds = maximumWan3TariffSourceDuration(input.context.durationSec);
  if (!Number.isFinite(maxInputSeconds) || maxInputSeconds < 0 || (maxInputSeconds === 0 && input.context.mode !== 'ref2v')) {
    throw new Error('Unsupported continuous Wan duration range.');
  }
  const minimum = input.context.mode === 'ref2v' ? 0 : Number.MIN_VALUE;
  const factsAt = (seconds: number) => buildBillingPricingFacts({ ...input.context, inputVideoDurationSec: seconds,
    hasVideoInput: seconds > 0 }, input.context.engine.pricingDetails, 'USD').facts;
  const initialFacts = factsAt(minimum);
  const selector = continuousWan3TariffSelector(buildManualTariffScenario({ ...input.context, inputVideoDurationSec: minimum }, initialFacts).selector);
  if (!selector) throw new Error('Unsupported continuous Wan duration.');
  return validateMonotoneContinuousTariffDomain({ price: input.price, selector, unit: 'input_video_seconds',
    minimum, maximum: maxInputSeconds, factsAt });
}
