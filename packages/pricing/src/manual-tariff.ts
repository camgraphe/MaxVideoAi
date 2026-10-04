import type { CanonicalPricingQuote, PricingFacts } from './canonical';
import { evaluateManualTariffPrice, isValidManualTariffPrice, manualTariffUnitNames, type ManualTariffPrice } from './manual-tariff-price';
export { isValidManualTariffPrice, manualTariffUnitNames } from './manual-tariff-price';
export type { ManualTariffPrice, ManualTariffComponent } from './manual-tariff-price';

export type ManualTariffSelector = Readonly<Record<string, string>>;
export type ManualTariffCell = {
  id: string;
  selector: ManualTariffSelector;
  source: 'versioned' | 'database';
  version: number;
  currency: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  price: ManualTariffPrice;
};

export type ManualTariffQuote = CanonicalPricingQuote & {
  pricingMode: 'manual_tariff';
  manualTariff: {
    cellId: string;
    kind: ManualTariffCell['price']['kind'];
    exactCustomerCents: number;
    units: readonly { unit: string; quantity: number; centsPerUnit: number; componentId?: string; billedQuantity?: number }[];
  };
};

export type ManualTariffParityScenario = {
  scenarioId: string;
  selector: ManualTariffSelector;
  facts: PricingFacts;
  quantities: Readonly<Record<string, number>>;
  currentCustomerCents: number;
};

export type ManualTariffParityIssue = {
  scenarioId: string;
  code: ManualTariffError['code'] | 'empty_matrix' | 'duplicate_scenario' | 'invalid_baseline' | 'customer_price_mismatch';
  currentCustomerCents?: number;
  manualCustomerCents?: number;
};

export class ManualTariffError extends Error {
  constructor(readonly code: 'missing_cell' | 'ambiguous_cell' | 'invalid_quantity' | 'below_cost' | 'invalid_cell', message: string) {
    super(message);
    this.name = 'ManualTariffError';
  }
}

function selectorKey(selector: ManualTariffSelector): string {
  if (!selector.engineId || Object.entries(selector).some(([key, value]) =>
    !key.trim() || typeof value !== 'string' || !value.trim())) {
    throw new ManualTariffError('invalid_cell', 'A manual tariff selector needs an engine and non-empty exact dimensions.');
  }
  return JSON.stringify(Object.entries(selector).sort(([left], [right]) => left.localeCompare(right)));
}

function instant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new ManualTariffError('invalid_cell', `Invalid manual tariff date: ${value}`);
  return parsed;
}

function activeMatches(
  cells: readonly ManualTariffCell[],
  key: string,
  at: number,
  source: ManualTariffCell['source'],
): ManualTariffCell[] {
  return cells.filter((cell) => {
    if (cell.source !== source || selectorKey(cell.selector) !== key) return false;
    if (!cell.id.trim() || !Number.isSafeInteger(cell.version) || cell.version < 1) {
      throw new ManualTariffError('invalid_cell', 'Manual tariff ID and version must be valid.');
    }
    const from = instant(cell.effectiveFrom);
    const until = cell.effectiveUntil ? instant(cell.effectiveUntil) : Infinity;
    if (until <= from) throw new ManualTariffError('invalid_cell', 'Manual tariff period is empty.');
    return from <= at && at < until;
  });
}

export function resolveManualTariffCell(input: {
  selector: ManualTariffSelector;
  at: string;
  versionedCells: readonly ManualTariffCell[];
  databaseCells: readonly ManualTariffCell[];
}): ManualTariffCell {
  if (input.versionedCells.some((cell) => cell.source !== 'versioned') ||
      input.databaseCells.some((cell) => cell.source !== 'database')) {
    throw new ManualTariffError('invalid_cell', 'Manual tariff source does not match its collection.');
  }
  const key = selectorKey(input.selector);
  const at = instant(input.at);
  const database = activeMatches(input.databaseCells, key, at, 'database');
  if (database.length > 1) throw new ManualTariffError('ambiguous_cell', `Overlapping database tariffs for ${key}`);
  if (database.length === 1) return database[0];
  const versioned = activeMatches(input.versionedCells, key, at, 'versioned');
  if (versioned.length > 1) throw new ManualTariffError('ambiguous_cell', `Overlapping versioned tariffs for ${key}`);
  if (versioned.length === 1) return versioned[0];
  throw new ManualTariffError('missing_cell', `No active manual tariff for ${key}`);
}

export function quoteCanonicalManualTariff(input: {
  facts: PricingFacts;
  scenarioId: string;
  selector: ManualTariffSelector;
  quantities: Readonly<Record<string, number>>;
  at: string;
  versionedCells: readonly ManualTariffCell[];
  databaseCells: readonly ManualTariffCell[];
}): ManualTariffQuote {
  const { facts, selector, quantities } = input;
  const cell = resolveManualTariffCell(input);
  if (selector.engineId !== facts.engineId || !input.scenarioId.trim() ||
      !cell.currency.trim() || !facts.currency.trim() ||
      facts.currency.trim().toUpperCase() !== cell.currency.trim().toUpperCase() ||
      !Number.isFinite(facts.vendorSubtotalExactCents) || facts.vendorSubtotalExactCents < 0 ||
      !Number.isFinite(facts.quantity) || facts.quantity <= 0 || !facts.unit.trim()) {
    throw new ManualTariffError('invalid_cell', 'Manual tariff facts, scenario and currency must agree.');
  }
  if (!isValidManualTariffPrice(cell.price)) throw new ManualTariffError('invalid_cell', 'Invalid authored customer tariff.');
  const termNames = manualTariffUnitNames(cell.price);
  if (Object.keys(quantities).length !== termNames.length ||
      Object.keys(quantities).some((unit) => !termNames.includes(unit)) ||
      termNames.some((unit) => !Number.isFinite(quantities[unit]) || quantities[unit] < 0)) {
    throw new ManualTariffError('invalid_quantity', 'Manual tariff quantities must match every authored unit exactly.');
  }
  let evaluated;
  try { evaluated = evaluateManualTariffPrice(cell.price, quantities); }
  catch (error) {
    if (error instanceof RangeError) throw new ManualTariffError('invalid_quantity', error.message);
    throw error;
  }
  const { customerTotalCents, exactCustomerCents, units } = evaluated;
  if (!Number.isSafeInteger(customerTotalCents) || customerTotalCents < 0) {
    throw new ManualTariffError('invalid_cell', 'Manual customer total is outside the supported cent range.');
  }
  const vendorSubtotalCents = Math.ceil(facts.vendorSubtotalExactCents - 1e-9);
  if (customerTotalCents < vendorSubtotalCents) {
    throw new ManualTariffError('below_cost', 'A below-cost tariff needs a separate settlement policy.');
  }
  const grossDifferenceCents = customerTotalCents - vendorSubtotalCents;
  return {
    pricingMode: 'manual_tariff',
    manualTariff: { cellId: cell.id, kind: cell.price.kind, exactCustomerCents, units },
    engineId: facts.engineId,
    scenarioId: input.scenarioId,
    membershipTier: 'member',
    currency: cell.currency.trim().toUpperCase(),
    vendorSubtotalCents,
    marginCents: grossDifferenceCents,
    surchargeCents: 0,
    discountCents: 0,
    subtotalBeforeDiscountCents: customerTotalCents,
    customerTotalCents,
    platformFeeCents: grossDifferenceCents,
    vendorShareCents: vendorSubtotalCents,
    unit: facts.unit,
    quantity: facts.quantity,
    breakdown: {
      vendorSubtotalExactCents: facts.vendorSubtotalExactCents,
      marginPercent: 0,
      marginFlatCents: 0,
      surchargePercent: 0,
      discountPercent: 0,
    },
    policyProvenance: {
      source: cell.source,
      matchedBy: 'precise',
      sourceRuleId: cell.id,
      compatibilityProfile: 'manual-tariff',
    },
  };
}

/** Audits only the supplied scenario matrix; its caller must establish exhaustive sellable coverage. */
export function auditManualTariffParity(input: {
  scenarios: readonly ManualTariffParityScenario[];
  at: string;
  versionedCells: readonly ManualTariffCell[];
  databaseCells: readonly ManualTariffCell[];
}): { ready: boolean; checkedScenarios: number; issues: ManualTariffParityIssue[] } {
  const issues: ManualTariffParityIssue[] = [];
  if (!input.scenarios.length) issues.push({ scenarioId: '*', code: 'empty_matrix' });
  const seen = new Set<string>();
  for (const scenario of input.scenarios) {
    if (!scenario.scenarioId.trim() || seen.has(scenario.scenarioId)) {
      issues.push({ scenarioId: scenario.scenarioId, code: 'duplicate_scenario' });
      continue;
    }
    seen.add(scenario.scenarioId);
    if (!Number.isSafeInteger(scenario.currentCustomerCents) || scenario.currentCustomerCents < 0) {
      issues.push({ scenarioId: scenario.scenarioId, code: 'invalid_baseline' });
      continue;
    }
    try {
      const quote = quoteCanonicalManualTariff({
        ...scenario,
        at: input.at,
        versionedCells: input.versionedCells,
        databaseCells: input.databaseCells,
      });
      if (quote.customerTotalCents !== scenario.currentCustomerCents) {
        issues.push({ scenarioId: scenario.scenarioId, code: 'customer_price_mismatch',
          currentCustomerCents: scenario.currentCustomerCents,
          manualCustomerCents: quote.customerTotalCents });
      }
    } catch (error) {
      if (!(error instanceof ManualTariffError)) throw error;
      issues.push({ scenarioId: scenario.scenarioId, code: error.code });
    }
  }
  return { ready: issues.length === 0, checkedScenarios: input.scenarios.length, issues };
}
