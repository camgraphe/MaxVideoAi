import {
  ManualTariffError,
  quoteCanonicalManualTariff,
  resolveManualTariffCell,
  type ManualTariffQuote,
  type PricingFacts,
} from '@maxvideoai/pricing';

import type { PricingContext } from '@/lib/pricing-context';
import { buildManualTariffScenario } from '@/lib/pricing-manual-scenario';
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
  const scenario = buildManualTariffScenario(input.context, input.facts);
  const cell = resolveManualTariffCell({ selector: scenario.selector, at: input.at,
    versionedCells: input.state.versionedCells, databaseCells: input.state.databaseCells });
  const quantities: Record<string, number> = {};
  if (cell.price.kind === 'unit_terms') {
    for (const term of cell.price.terms) {
      const quantity = scenario.quantities[term.unit];
      if (quantity === undefined) throw new ManualTariffError('invalid_quantity', `Unresolved manual tariff unit: ${term.unit}`);
      quantities[term.unit] = quantity;
    }
  }
  const quote = quoteCanonicalManualTariff({
    facts: input.facts,
    scenarioId: `billing:${input.context.engine.id}:${input.context.mode ?? 't2v'}:${input.context.resolution}`,
    selector: scenario.selector,
    quantities,
    at: input.at,
    versionedCells: input.state.versionedCells,
    databaseCells: input.state.databaseCells,
  });
  return { quote, revision: input.state.revision };
}
