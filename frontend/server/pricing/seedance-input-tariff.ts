import type { ManualTariffPrice } from '@maxvideoai/pricing';
import type { PricingContext } from '@/lib/pricing-context';
import { supportsSeedanceInputTariff, validateSeedanceInputTariffDuration } from '@/lib/seedance-input-tariff';
import { estimateBytePlusBillableTokens } from '@/server/byteplus-accounting';
import { normalBytePlusSupplierCost } from '@/server/byteplus-normal-cost';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import { validateMonotoneContinuousTariffDomain } from './continuous-tariff-domain';

export function seedanceInputTariffBasis(context: PricingContext) {
  if (context.workflowStep || !supportsSeedanceInputTariff(context.engine.id, context.mode ?? '', 'video_input')
    || context.hasVideoInput === false) throw new Error('Unsupported normal Seedance video-input tariff.');
  const maximum = validateSeedanceInputTariffDuration(context.engine.id, context.inputVideoDurationSec ?? NaN);
  const estimate = estimateBytePlusBillableTokens({ engineId: context.engine.id,
    durationSec: context.durationSec, resolution: context.resolution, aspectRatio: context.aspectRatio,
    billingInputType: 'video_input', inputVideoDurationSec: Number.MIN_VALUE });
  if (!estimate) throw new Error('Unsupported published Seedance video-input minimum.');
  const tokensPerSecond = estimate.width * estimate.height * 24 / 1024;
  const minimumBillableSeconds = estimate.minimumTokens / tokensPerSecond;
  return { maximum, minimumBillableSeconds, includedInputSeconds: minimumBillableSeconds - context.durationSec };
}

/** Authoring only: freezes a reviewed positive margin into literal customer amounts.
 * Quotes evaluate these amounts; a future supplier/contract change never silently reprices them.
 */
export function prepareSeedanceInputTariffPrice(input: {
  context: PricingContext; currentCustomerCents: number; noVideoCustomerCents?: number; at: string;
}) {
  const { context, at } = input;
  const basis = seedanceInputTariffBasis(context);
  const minimumCost = normalBytePlusSupplierCost({ ...context, hasVideoInput: true,
    inputVideoDurationSec: Number.MIN_VALUE }, at);
  if (!minimumCost || minimumCost.amountUsd <= 0 || !Number.isSafeInteger(input.currentCustomerCents)
    || input.currentCustomerCents <= 0) throw new Error('Current supplier and customer amounts are required.');
  let minimumCustomerCents = input.currentCustomerCents;
  let marginSource: 'current_video_minimum' | 'no_video_variant' = 'current_video_minimum';
  if (minimumCustomerCents <= minimumCost.amountUsd * 100) {
    const noVideoCost = normalBytePlusSupplierCost({ ...context, hasVideoInput: false,
      inputVideoDurationSec: undefined }, at);
    if (!noVideoCost || noVideoCost.amountUsd <= 0 || !Number.isSafeInteger(input.noVideoCustomerCents)
      || input.noVideoCustomerCents! <= noVideoCost.amountUsd * 100) throw new Error('A positive reviewed variant margin is required.');
    minimumCustomerCents = Math.ceil(minimumCost.amountUsd / noVideoCost.amountUsd * input.noVideoCustomerCents! - 1e-9);
    marginSource = 'no_video_variant';
  }
  return { ...basis, minimumCustomerCents, marginSource,
    price: seedanceInputTariffPriceFromRate(context, minimumCustomerCents / basis.minimumBillableSeconds),
    marginPercent: (1 - minimumCost.amountUsd * 100 / minimumCustomerCents) * 100 };
}

export function seedanceInputTariffPriceFromRate(context: PricingContext, customerCentsPerBillableSecond: number): ManualTariffPrice {
  const basis = seedanceInputTariffBasis(context);
  if (!Number.isFinite(customerCentsPerBillableSecond) || customerCentsPerBillableSecond <= 0) {
    throw new Error('A positive customer billable-second rate is required.');
  }
  return { kind: 'unit_components', rounding: 'up', components: [{ id: 'retail', rounding: 'none',
    flatCents: customerCentsPerBillableSecond * basis.minimumBillableSeconds,
    terms: [{ unit: 'input_video_seconds', centsPerUnit: customerCentsPerBillableSecond,
      includedUnits: basis.includedInputSeconds }] }] };
}

export function seedanceInputTariffRate(context: PricingContext, price: ManualTariffPrice): number {
  const basis = seedanceInputTariffBasis(context);
  if (price.kind !== 'unit_components' || price.rounding !== 'up' || price.components.length !== 1) {
    throw new Error('Seedance requires proportional billable-second pricing.');
  }
  const component = price.components[0];
  const term = component.terms[0];
  if (component.rounding !== 'none' || component.precision !== undefined || component.terms.length !== 1
    || !term || term.unit !== 'input_video_seconds' || !Number.isFinite(term.centsPerUnit) || term.centsPerUnit <= 0
    || term.quantityRounding || term.quantityNormalization
    || Math.abs((term.includedUnits ?? NaN) - basis.includedInputSeconds) > 1e-8
    || term.includedUnits === undefined
    || Math.abs(component.flatCents - term.centsPerUnit * basis.minimumBillableSeconds) > 1e-8) {
    throw new Error('Seedance requires a proportional rate and its published minimum.');
  }
  return term.centsPerUnit;
}

/** Checks every supplier-cent interval, including fractional input and the minimum plateau. */
export function validateSeedanceInputTariffDomain(input: { context: PricingContext; price: ManualTariffPrice; at?: string }) {
  const basis = seedanceInputTariffBasis(input.context);
  seedanceInputTariffRate(input.context, input.price);
  const at = input.at ?? new Date().toISOString();
  const factsAt = (seconds: number) => {
    const context = { ...input.context, hasVideoInput: true, inputVideoDurationSec: seconds };
    const cost = normalBytePlusSupplierCost(context, at);
    if (!cost) throw new Error('Current supplier reference is unavailable.');
    return { ...buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts,
      vendorSubtotalExactCents: Number((cost.amountUsd * 100).toFixed(6)) };
  };
  const facts = factsAt(Number.MIN_VALUE);
  const selector = continuousInputTariffSelector(buildManualTariffScenario(input.context, facts).selector);
  if (!selector) throw new Error('Unsupported continuous Seedance input tariff.');
  return validateMonotoneContinuousTariffDomain({ price: input.price, selector, unit: 'input_video_seconds',
    minimum: Number.MIN_VALUE, maximum: basis.maximum, factsAt });
}
