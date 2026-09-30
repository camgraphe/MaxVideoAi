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

export class CustomerTariffUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = 'CustomerTariffUnavailableError'; }
}

export function resolveCustomerTariffQuote(input: {
  context: PricingContext;
  facts: PricingFacts;
  at: string;
  state: EffectiveCustomerTariffState;
}): { quote: ManualTariffQuote; revision: number } | null {
  if (input.state.status === 'unavailable') throw new CustomerTariffUnavailableError('Customer tariff database unavailable');
  if (!input.state.active) return null;
  const state = input.state;
  const scenario = buildManualTariffScenario(input.context, input.facts);
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
    const unit = continuous.inputAudioDurationSec === 'continuous' ? 'input_audio_seconds' : 'input_video_seconds';
    if (cell.price.kind === 'fixed' || !manualTariffUnitNames(cell.price).includes(unit)) {
      throw new ManualTariffError('invalid_cell', 'Continuous source pricing requires an authored input-second rate.');
    }
  }
  const quantities: Record<string, number> = {};
  for (const unit of manualTariffUnitNames(cell.price)) {
    const quantity = scenario.quantities[unit];
    if (quantity === undefined) throw new ManualTariffError('invalid_quantity', `Unresolved manual tariff unit: ${unit}`);
    quantities[unit] = quantity;
  }
  const quote = quoteCanonicalManualTariff({
    facts: input.facts,
    scenarioId: `billing:${input.context.engine.id}:${input.context.mode ?? 't2v'}:${input.context.resolution}`,
    selector,
    quantities,
    at: input.at,
    versionedCells: input.state.versionedCells,
    databaseCells: input.state.databaseCells,
  });
  return { quote, revision: input.state.revision };
}
