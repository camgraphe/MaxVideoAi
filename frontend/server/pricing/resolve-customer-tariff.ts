import {
  ManualTariffError,
  quoteCanonicalManualTariff,
  resolveManualTariffCell,
  manualTariffUnitNames,
  type ManualTariffQuote,
  type PricingFacts,
} from '@maxvideoai/pricing';

import type { PricingContext } from '@/lib/pricing-context';
import { buildManualTariffScenario, continuousInputTariffSelector } from '@/lib/pricing-manual-scenario';
import type { EffectiveCustomerTariffState } from './customer-tariff-store';
import { normalBytePlusSupplierCost } from '@/server/byteplus-normal-cost';
import { supportsSeedanceInputTariff, validateSeedanceInputTariffDuration } from '@/lib/seedance-input-tariff';
import { isSeedance25LasInputPricing, isSeedance25EditInputPricing } from '@/server/byteplus-las-tariff';
import { seedanceInputTariffRate } from './seedance-input-tariff';
import { normalizeSeedancePricingContext } from '@/lib/seedance-option-pricing';

export class CustomerTariffUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'CustomerTariffUnavailableError'; }
}

export function resolveCustomerTariffQuote(input: {
  context: PricingContext;
  facts: PricingFacts;
  at: string;
  state: EffectiveCustomerTariffState;
}): { quote: ManualTariffQuote; revision: number; supplierCost: ReturnType<typeof normalBytePlusSupplierCost> } | null {
  input = { ...input, context: normalizeSeedancePricingContext(input.context) };
  if (input.state.status === 'unavailable') throw new CustomerTariffUnavailableError('Customer tariff database unavailable');
  if (!input.state.active) return null;
  const state = input.state;
  const scenario = buildManualTariffScenario(input.context, input.facts);
  if (supportsSeedanceInputTariff(scenario.selector.engineId, scenario.selector.mode, scenario.selector.billingInputType)) {
    validateSeedanceInputTariffDuration(input.context.engine.id, input.context.inputVideoDurationSec ?? NaN);
  }
  const las = !input.context.workflowStep && isSeedance25LasInputPricing(input.context.engine.id, input.context.mode);
  const lasSupplierCost = las && input.facts.currency.toUpperCase() === 'USD'
    ? normalBytePlusSupplierCost(input.context, input.at) : null;
  if (las && !lasSupplierCost) throw new CustomerTariffUnavailableError('Verified LAS Edit supplier cost is required.');
  const resolve = (selector: typeof scenario.selector) => resolveManualTariffCell({ selector, at: input.at,
    versionedCells: state.versionedCells, databaseCells: state.databaseCells });
  let selector = scenario.selector;
  let cell;
  try { cell = resolve(selector); }
  catch (error) {
    if (!(error instanceof ManualTariffError) || error.code !== 'missing_cell') throw error;
    const continuous = continuousInputTariffSelector(selector);
    if (!continuous) throw error;
    selector = continuous;
    cell = resolve(selector);
    const units = manualTariffUnitNames(cell.price);
    const unit = continuous.inputAudioDurationSec === 'continuous' ? 'input_audio_seconds' : 'input_video_seconds';
    const omni = continuous.engineId === 'gemini-omni-flash';
    const openUnit = continuous.referenceTokenBudget === 'continuous' ? 'reference_tokens'
      : ['lumaRay2', 'lumaRay2_flash'].includes(continuous.engineId) ? 'output_seconds' : null;
    const requiredInput = openUnit ? units.includes(openUnit) : units.includes(unit) || (omni && units.includes('input_tokens'));
    const requiredOutput = !omni || units.includes('output_tokens') || units.includes('output_seconds');
    if (cell.price.kind === 'fixed' || !requiredInput || !requiredOutput) {
      throw new ManualTariffError('invalid_cell', 'Continuous source pricing requires an authored input-second rate.');
    }
  }
  const quantities: Record<string, number> = {};
  for (const unit of manualTariffUnitNames(cell.price)) {
    const quantity = scenario.quantities[unit];
    if (quantity === undefined) throw new ManualTariffError('invalid_quantity', `Unresolved manual tariff unit: ${unit}`);
    quantities[unit] = quantity;
  }
  const supplierCost = lasSupplierCost ?? (input.facts.currency.toUpperCase() === 'USD'
    ? normalBytePlusSupplierCost(input.context, input.at) : null);
  if (!input.context.workflowStep && isSeedance25EditInputPricing(input.context.engine.id, input.context.mode)) {
    if (!supplierCost) throw new CustomerTariffUnavailableError(`Verified ${las ? 'LAS' : 'ModelArk'} Edit supplier cost is required.`);
    try { seedanceInputTariffRate(input.context, cell.price); }
    catch { throw new CustomerTariffUnavailableError(`A reviewed ${las ? 'LAS' : 'ModelArk'} Edit input-plus-output tariff is required.`); }
  }
  const quote = quoteCanonicalManualTariff({
    facts: supplierCost ? { ...input.facts, vendorSubtotalExactCents: Number((supplierCost.amountUsd * 100).toFixed(6)) } : input.facts,
    scenarioId: `billing:${input.context.engine.id}:${input.context.mode ?? 't2v'}:${input.context.resolution}`,
    selector,
    quantities,
    at: input.at,
    versionedCells: input.state.versionedCells,
    databaseCells: input.state.databaseCells,
  });
  return { quote, revision: input.state.revision, supplierCost };
}
