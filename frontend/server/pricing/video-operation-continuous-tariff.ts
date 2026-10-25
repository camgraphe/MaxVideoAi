import { isValidManualTariffPrice, quoteCanonicalPricing, type ManualTariffPrice, type PricingCompatibilityProfile,
  type ResolvedPricingPolicy } from '@maxvideoai/pricing';
import { normalizeVideoOperation, usesOperationReferenceSettlement } from '@/lib/video-operation';
import type { PricingContext } from '@/lib/pricing-context';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { isFluxLtxSourceOperation, fluxLtxDurationBounds } from '@/lib/flux-ltx-operations';
import { compileBoundedUnitBands } from './compile-bounded-unit-bands';
import { adjacentNonnegativeDouble } from './pricing-number-boundaries';

export function isOperationContinuousTariff(context: PricingContext): boolean {
  return usesOperationReferenceSettlement(context.engine.id, context.mode ?? 't2v', context.operation);
}

export function operationContinuousTariffBounds(context: PricingContext) {
  context = { ...context, operation: normalizeVideoOperation(context.engine.id, context.mode ?? 't2v', context.operation) };
  const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
  const selector = continuousInputTariffSelector(buildManualTariffScenario(context, facts).selector);
  if (!selector?.operation || !isOperationContinuousTariff(context)) throw new Error('Unsupported operation source tariff.');
  const flux = isFluxLtxSourceOperation(context.operation) ? fluxLtxDurationBounds(context.operation) : null;
  const minimum = context.operation === 'kling-edit' ? 3 : context.operation === 'h3-recast' ? 5
    : context.operation === 'h3-relight' ? 56 / 24 : Number.MIN_VALUE;
  const maximum = flux ? flux.maxExclusive ? adjacentNonnegativeDouble(flux.max, 'previous') : flux.max
    : context.operation === 'h3-recast' ? 30 : 15;
  const factsAt = (seconds: number) => buildBillingPricingFacts({ ...context, durationSec: seconds,
    inputVideoDurationSec: seconds }, context.engine.pricingDetails, 'USD').facts;
  return { minimum, maximum, selector, factsAt };
}

/** Maintenance only: canonical rounding is frozen at every representable cent
 * transition. Runtime consumes source seconds and literal bands, never a rate. */
export function compileOperationContinuousTariffPrice(input: {
  context: PricingContext; policy: ResolvedPricingPolicy; compatibilityProfile: PricingCompatibilityProfile;
}): ManualTariffPrice {
  const { context, policy, compatibilityProfile } = input;
  const { minimum, maximum, factsAt } = operationContinuousTariffBounds(context);
  if (policy.rule.currency !== 'USD' || compatibilityProfile.id !== 'standard') throw new Error('Reviewed standard operation pricing is required.');
  const price = compileBoundedUnitBands({ terms: [{ unit: 'input_video_seconds', centsPerUnit: 1 }], divisor: 1, maxUnits: maximum,
    currentCents: seconds => quoteCanonicalPricing({ facts: factsAt(Math.max(minimum, seconds)), policy, compatibilityProfile,
      scenario: { id: 'compile-video-operation', engineId: context.engine.id, mode: context.mode, resolution: context.resolution,
        membershipTier: 'member', discountPercent: 0 } }).customerTotalCents });
  validateOperationContinuousTariffDomain({ context, price });
  return price;
}

/** Monotone canonical-standard reference normalization at each band's upper neighbor covers the
 * complete admitted source domain. It is an estimate guard, not invoice proof. */
export function validateOperationContinuousTariffDomain(input: { context: PricingContext; price: ManualTariffPrice }) {
  const { minimum, maximum, factsAt } = operationContinuousTariffBounds(input.context), { price } = input;
  if (!isValidManualTariffPrice(price) || price.kind !== 'unit_bands' || price.divisor !== 1 || price.maxUnits !== maximum
    || price.terms.length !== 1 || price.terms[0].unit !== 'input_video_seconds' || price.terms[0].centsPerUnit !== 1) {
    throw new Error('Unsupported authored source-operation bands.');
  }
  let minimumGrossCents = Infinity, checkedBoundaries = 0;
  for (let index = 0; index < price.bands.length; index++) {
    const band = price.bands[index], end = Math.min(maximum, index + 1 < price.bands.length
      ? adjacentNonnegativeDouble(price.bands[index + 1].minUnits, 'previous') : maximum);
    if (end < minimum) continue;
    const gross = band.customerCents - Math.round(factsAt(end).vendorSubtotalExactCents);
    if (gross < 0) throw new Error(`Operation tariff ${input.context.operation}/${input.context.resolution} at ${end}: ${band.customerCents} cents falls below factual reference ${factsAt(end).vendorSubtotalExactCents}.`);
    minimumGrossCents = Math.min(minimumGrossCents, gross);
    checkedBoundaries++;
  }
  if (!checkedBoundaries) throw new Error('Empty operation tariff domain.');
  return { maxInputSeconds: maximum, checkedBoundaries, minimumGrossCents };
}
