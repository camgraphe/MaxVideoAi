import { isDeepStrictEqual } from 'node:util';
import { isValidManualTariffPrice, type ManualTariffComponent, type ManualTariffPrice,
  type PricingCompatibilityProfile, type ResolvedPricingPolicy } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import { getLumaRay2EditRateUsd } from '@/lib/luma-ray2-pricing-config';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';

type Normalization = NonNullable<ManualTariffComponent['terms'][number]['quantityNormalization']>;
export function isOpenQuantityTariff(engineId: string, mode: string) {
  return (['lumaRay2', 'lumaRay2_flash'].includes(engineId) && mode === 'v2v')
    || (engineId === 'minimax-h3-max' && mode === 'ref2v');
}
function normalization(context: PricingContext): { unit: string; rule: Normalization; centsPerUnit: number } {
  if (!isOpenQuantityTariff(context.engine.id, context.mode ?? '')) throw new Error('Unsupported open quantity tariff.');
  if (context.engine.id === 'minimax-h3-max') {
    const base = buildBillingPricingFacts({ ...context, referenceTokenBudget: 0, verifiedReferenceTokenCount: undefined }, context.engine.pricingDetails, 'USD');
    return { unit: 'reference_tokens', centsPerUnit: .002, rule: { includedUnits: 4096, denominator: .002, steps: [
      { operation: 'multiply', amount: .02 }, { operation: 'divide', amount: 1000 }, { operation: 'decimal', precision: 8 },
      { operation: 'add', amount: base.facts.vendorSubtotalExactCents / 100 }, { operation: 'decimal', precision: 8 },
      { operation: 'multiply', amount: 100 }, { operation: 'decimal', precision: 6 },
    ] } };
  }
  const rate = getLumaRay2EditRateUsd(context.engine.id, 'modify');
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid Luma unit normalization.');
  return { unit: 'output_seconds', centsPerUnit: rate * 100, rule: { denominator: rate * 100, steps: [
    { operation: 'multiply', amount: rate }, { operation: 'decimal', precision: 4 },
    { operation: 'multiply', amount: 100 }, { operation: 'round', rounding: 'nearest' },
  ] } };
}

/** Capture literal rates once. Runtime amounts use only the authored cell and trusted units. */
export function compileOpenQuantityTariffPrice(input: {
  context: PricingContext; policy: ResolvedPricingPolicy; compatibilityProfile: PricingCompatibilityProfile;
}): ManualTariffPrice {
  const { context, policy, compatibilityProfile: profile } = input;
  const { unit, rule, centsPerUnit } = normalization(context);
  const margin = profile.marginPercentOverride ?? policy.rule.marginPercent;
  const flat = profile.marginFlatCentsOverride ?? policy.rule.marginFlatCents;
  if (policy.rule.currency !== 'USD' || ![margin, flat].every(n => Number.isFinite(n) && n >= 0)
    || (profile.discountPercentOverride ?? 0) !== 0 || profile.vendorShareMode === 'zero'
    || profile.totalRounding !== 'nearest') throw new Error('Unsupported open quantity price profile.');
  if (context.engine.id === 'minimax-h3-max') {
    if (profile.subtotalRounding !== 'up' || (profile.subtotalRoundingIncrementCents ?? 1) !== 1) throw new Error('Unsupported token rounding.');
    const retailRate = centsPerUnit * (1 + margin);
    if (retailRate / rule.denominator !== 1 + margin) throw new Error('Token rate conversion requires an explicit rounding review.');
    return { kind: 'unit_components', rounding: 'nearest', components: [{ id: 'retail', flatCents: flat,
      rounding: 'up', terms: [{ unit, centsPerUnit: retailRate, quantityNormalization: rule }] }] };
  }
  if (profile.vendorSubtotalRounding !== 'preserve' || profile.subtotalRounding || !['up', 'nearest'].includes(profile.marginRounding)) {
    throw new Error('Unsupported Luma rounding.');
  }
  const roundingRate = centsPerUnit * margin;
  if (roundingRate / rule.denominator !== margin) throw new Error('Luma rate conversion requires an explicit rounding review.');
  return { kind: 'unit_components', rounding: 'nearest', components: [
    { id: 'base', flatCents: 0, rounding: 'none', terms: [{ unit, centsPerUnit, quantityNormalization: rule }] },
    { id: 'rounding-adjustment', flatCents: flat, rounding: profile.marginRounding as 'up' | 'nearest',
      terms: [{ unit, centsPerUnit: roundingRate, quantityNormalization: rule }] },
  ] };
}

/** Structural monotonic proof over all trusted integers, including native rounding. No sampled cap. */
export function validateOpenQuantityTariffDomain(input: { context: PricingContext; price: ManualTariffPrice }) {
  const { context, price } = input;
  const expected = normalization(context);
  if (!isValidManualTariffPrice(price) || price.kind !== 'unit_components') throw new Error('Open quantity pricing requires authored unit components.');
  const native = price.components.every(c => c.terms.every(t => t.unit === expected.unit
    // JSONB reorders object keys. Values and ordered normalization steps define
    // the native curve; serialization order does not change its arithmetic.
    && isDeepStrictEqual(t.quantityNormalization, expected.rule)));
  if (native) {
    const base = price.components[0];
    if (price.components.some(c => c.precision !== undefined || c.terms.length !== 1)) throw new Error('Unsupported open quantity component rounding.');
    if (context.engine.id === 'minimax-h3-max') {
      if (price.components.length !== 1 || base.rounding !== 'up' || base.terms.length !== 1
        || base.terms[0].centsPerUnit < expected.centsPerUnit) throw new Error('Open token price is below cost.');
    } else if (price.components.length !== 2 || base.rounding !== 'none' || base.terms.length !== 1
      || base.terms[0].centsPerUnit < expected.centsPerUnit || price.rounding !== 'nearest') throw new Error('Open Luma price is below cost.');
  } else {
    // Deliberate repricing uses a simple literal unit rate. A one-cent reserve
    // covers vendor cent rounding; the strict slope reserve covers IEEE error.
    const component = price.components[0];
    if (price.components.length !== 1 || price.rounding !== 'up' || component.rounding !== 'none' || component.terms.length !== 1
      || component.terms[0].unit !== expected.unit || component.terms[0].quantityNormalization || component.terms[0].quantityRounding
      || component.precision !== undefined) throw new Error('Unsupported open quantity rounding.');
    const terms = component.terms[0];
    const baseFacts = buildBillingPricingFacts({ ...context, referenceTokenBudget: 0 }, context.engine.pricingDetails, 'USD').facts;
    const tokens = context.engine.id === 'minimax-h3-max';
    const requiredBase = tokens ? Math.ceil(baseFacts.vendorSubtotalExactCents - 1e-9) + 1 : 0;
    if ((tokens ? terms.includedUnits !== 4096 : terms.includedUnits !== undefined)
      || component.flatCents < requiredBase || terms.centsPerUnit < expected.centsPerUnit * (1 + 1e-12)) throw new Error('Open quantity price is below cost.');
  }
  return { maxInputSeconds: Number.MAX_SAFE_INTEGER, checkedBoundaries: 0, minimumGrossCents: 0,
    unbounded: true as const, quantityUnit: expected.unit, proof: 'monotone_authored_integer_units' as const };
}
