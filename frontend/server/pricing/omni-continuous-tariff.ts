import { isValidManualTariffPrice, quoteCanonicalPricing, type ManualTariffPrice, type PricingCompatibilityProfile, type ResolvedPricingPolicy } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { compileBoundedUnitBands } from './compile-bounded-unit-bands';
import { adjacentNonnegativeDouble } from './pricing-number-boundaries';
import {
  calculateGoogleOmniProviderCost, GOOGLE_OMNI_OUTPUT_USD_PER_MILLION_TOKENS,
  GOOGLE_OMNI_1_1_OUTPUT_USD_PER_MILLION_TOKENS, GOOGLE_OMNI_INPUT_USD_PER_MILLION_TOKENS,
  type GoogleOmniPricingInput,
} from '@/lib/google-omni-pricing';

export function omniContinuousTariffBounds(context: PricingContext, pricingVersion: GoogleOmniPricingInput['pricingVersion'] = '1.2') {
  const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
  if (context.engine.id !== 'gemini-omni-flash' || !continuousInputTariffSelector(buildManualTariffScenario(context, facts).selector)) {
    throw new Error('Unsupported continuous Omni scenario.');
  }
  const outputVaries = context.mode !== 'extend';
  const minimumOutput = outputVaries ? 3 : context.durationSec;
  const maximumOutput = outputVaries ? 10 : context.durationSec;
  const maximumSource = context.mode === 'retake' ? 0 : 10;
  const factsAt = (output: number, source: number) => buildBillingPricingFacts({ ...context, inputVideoDurationSec: source,
    ...(outputVaries ? { inheritedDurationSec: output } : { durationSec: output }) }, context.engine.pricingDetails, 'USD').facts;
  // Bands are evaluated in their authored token expression. A supplier price
  // decrease must not shrink the reachable domain of historical retail bands.
  const basisAt = (output: number, source: number) => calculateGoogleOmniProviderCost({
    pricingVersion, outputResolution: context.resolution as GoogleOmniPricingInput['outputResolution'],
    outputDurationSec: output, inputImageCount: context.inputImageCount ?? 0, inputVideoDurationSec: source,
  }).providerCostExactCents;
  return { minimumOutput, maximumOutput, maximumSource, factsAt, minimum: basisAt(minimumOutput, 0),
    maximum: basisAt(maximumOutput, maximumSource) };
}

/** Freeze all customer-cent bands over this bounded raw-token domain; no live percentage or supplier lookup. */
export function compileOmniContinuousTariffPrice(input: {
  context: PricingContext; policy: ResolvedPricingPolicy; compatibilityProfile: PricingCompatibilityProfile;
}): ManualTariffPrice {
  const { context, policy, compatibilityProfile: profile } = input;
  const built = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD');
  const scenario = buildManualTariffScenario(context, built.facts);
  if (context.engine.id !== 'gemini-omni-flash' || !continuousInputTariffSelector(scenario.selector)
    || policy.rule.currency !== 'USD' || profile.vendorSubtotalRounding !== 'preserve'
    || profile.subtotalRounding || (profile.discountPercentOverride ?? 0) !== 0 || profile.vendorShareMode === 'zero'
    || !['up', 'nearest'].includes(profile.marginRounding) || !['up', 'nearest'].includes(profile.totalRounding)) {
    throw new Error('Unsupported Omni continuous price profile; explicit review is required.');
  }
  const { maximum } = omniContinuousTariffBounds(context);
  return compileBoundedUnitBands({ terms: [{ unit: 'output_tokens', centsPerUnit: GOOGLE_OMNI_OUTPUT_USD_PER_MILLION_TOKENS },
    { unit: 'input_tokens', centsPerUnit: GOOGLE_OMNI_INPUT_USD_PER_MILLION_TOKENS }],
    divisor: 10000, maxUnits: maximum,
    currentCents: units => quoteCanonicalPricing({ facts: { engineId: context.engine.id, currency: 'USD',
      vendorSubtotalExactCents: units, quantity: 1, unit: 'token_budget' },
      scenario: { id: 'compile-omni', engineId: context.engine.id, membershipTier: 'member', discountPercent: 0 },
      policy, compatibilityProfile: profile }).customerTotalCents,
  });
}

/** Covers the full output/source rectangle, rather than a few sampled media durations. */
export function validateOmniContinuousTariffDomain(input: { context: PricingContext; price: ManualTariffPrice }) {
  const { context, price } = input;
  if (!isValidManualTariffPrice(price)) throw new Error('Invalid continuous Omni tariff.');
  const legacyBands = price.kind === 'unit_bands' && price.terms[0]?.centsPerUnit === GOOGLE_OMNI_1_1_OUTPUT_USD_PER_MILLION_TOKENS;
  const bounds = omniContinuousTariffBounds(context, legacyBands ? '1.1' : '1.2');
  let minimumGrossCents = Infinity;
  let checkedBoundaries = 0;
  if (price.kind === 'unit_bands') {
    if (price.divisor !== 10000 || price.terms.length !== 2 || price.terms[0].unit !== 'output_tokens'
      || ![GOOGLE_OMNI_OUTPUT_USD_PER_MILLION_TOKENS, GOOGLE_OMNI_1_1_OUTPUT_USD_PER_MILLION_TOKENS].includes(price.terms[0].centsPerUnit)
      || price.terms[1].unit !== 'input_tokens' || price.terms[1].centsPerUnit !== GOOGLE_OMNI_INPUT_USD_PER_MILLION_TOKENS
      || price.maxUnits < bounds.maximum) throw new Error('Unsupported authored Omni token bands.');
    for (let index = 0; index < price.bands.length; index++) {
      const band = price.bands[index];
      const start = Math.max(bounds.minimum, band.minUnits);
      const end = Math.min(bounds.maximum, index + 1 < price.bands.length
        ? adjacentNonnegativeDouble(price.bands[index + 1].minUnits, 'previous') : price.maxUnits);
      if (end < start) continue;
      const gross = band.customerCents - Math.ceil(end - 1e-9);
      if (gross < 0) throw new Error('Continuous Omni tariff falls below cost inside its reviewed range.');
      minimumGrossCents = Math.min(minimumGrossCents, gross);
      checkedBoundaries++;
    }
  } else {
    if (price.kind !== 'unit_components' || price.rounding !== 'nearest' || price.components.length !== 1) {
      throw new Error('Unsupported continuous Omni unit formula.');
    }
    const component = price.components[0];
    if (component.rounding !== 'none' || component.precision !== undefined || component.terms.length !== 2
      || component.terms.some(term => term.quantityRounding !== undefined)
      || component.terms[0].unit !== 'output_seconds' || component.terms[1].unit !== 'input_video_seconds') {
      throw new Error('Unsupported continuous Omni unit formula.');
    }
    // An affine difference reaches its minimum at a rectangle corner. The half-cent
    // reserve covers nearest retail rounding and a conservative floating-point bound.
    for (const output of [bounds.minimumOutput, bounds.maximumOutput]) for (const source of [0, bounds.maximumSource]) {
      const exact = component.flatCents + component.terms[0].centsPerUnit * output + component.terms[1].centsPerUnit * source;
      const difference = exact - bounds.factsAt(output, source).vendorSubtotalExactCents;
      if (difference < 0.500001) throw new Error('Unit rates cannot be certified above cost across all output and source durations.');
      minimumGrossCents = Math.min(minimumGrossCents, Math.floor(difference - 0.5));
      checkedBoundaries++;
    }
  }
  if (!checkedBoundaries || !Number.isFinite(minimumGrossCents)) throw new Error('Empty continuous Omni price domain.');
  return { maxInputSeconds: bounds.maximumSource, checkedBoundaries, minimumGrossCents };
}
