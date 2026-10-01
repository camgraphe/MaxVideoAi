/** Authored customer amounts. No component reads supplier facts or a commercial percentage. */
export type ManualTariffUnitTerm = { unit: string; centsPerUnit: number };
/** Frozen billable-unit normalization. Never reads a provider rate or a policy. */
export type ManualTariffUnitNormalization = {
  includedUnits?: number;
  denominator: number;
  steps: readonly (
    | { operation: 'multiply' | 'divide' | 'add'; amount: number }
    | { operation: 'decimal'; precision: number }
    | { operation: 'round'; rounding: 'up' | 'nearest' }
  )[];
};
export type ManualTariffComponent = {
  id: string;
  flatCents: number;
  precision?: number;
  rounding: 'none' | 'up' | 'nearest';
  terms: readonly (ManualTariffUnitTerm & { includedUnits?: number; quantityRounding?: { scale: number; precision: number }; quantityNormalization?: ManualTariffUnitNormalization })[];
};
export type ManualTariffPrice =
  | { kind: 'unit_bands'; divisor: number; maxUnits: number; terms: readonly ManualTariffUnitTerm[];
      bands: readonly { minUnits: number; customerCents: number }[] }
  | { kind: 'unit_terms'; rounding: 'up' | 'nearest'; terms: readonly ManualTariffUnitTerm[] }
  | { kind: 'unit_components'; rounding: 'up' | 'nearest'; components: readonly ManualTariffComponent[] }
  | { kind: 'fixed'; customerCents: number };

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function amount(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function precision(value: unknown): value is number { return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6; }
function terms(value: unknown, allowEmpty: boolean, allowNormalization: boolean): boolean {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)) return false;
  const names = new Set<string>();
  return value.every((term) => {
    if (!record(term) || typeof term.unit !== 'string' || !term.unit.trim() || names.has(term.unit) || !amount(term.centsPerUnit)) return false;
    names.add(term.unit);
    if (term.includedUnits !== undefined && (!allowNormalization || !amount(term.includedUnits) || term.quantityNormalization !== undefined)) return false;
    if (term.quantityRounding !== undefined) {
      const rule = term.quantityRounding;
      if (!allowNormalization || !record(rule) || !amount(rule.scale) || rule.scale === 0 || !precision(rule.precision)) return false;
    }
    if (term.quantityNormalization !== undefined) {
      const rule = term.quantityNormalization;
      if (!allowNormalization || term.quantityRounding !== undefined || !record(rule) || !amount(rule.denominator) || rule.denominator === 0
        || (rule.includedUnits !== undefined && !amount(rule.includedUnits)) || !Array.isArray(rule.steps) || !rule.steps.length || rule.steps.length > 12) return false;
      if (!rule.steps.every(step => record(step) && (
        (['multiply', 'divide', 'add'].includes(String(step.operation)) && amount(step.amount) && (step.operation !== 'divide' || step.amount > 0))
        || (step.operation === 'decimal' && Number.isInteger(step.precision) && Number(step.precision) >= 0 && Number(step.precision) <= 8)
        || (step.operation === 'round' && ['up', 'nearest'].includes(String(step.rounding)))
      ))) return false;
    }
    return true;
  });
}

export function isValidManualTariffPrice(value: unknown): value is ManualTariffPrice {
  if (!record(value)) return false;
  if (value.kind === 'fixed') return Number.isSafeInteger(value.customerCents) && Number(value.customerCents) >= 0;
  if (value.kind === 'unit_bands') {
    if (!amount(value.divisor) || value.divisor <= 0 || !amount(value.maxUnits) || value.maxUnits <= 0
      || !terms(value.terms, false, false) || !Array.isArray(value.bands) || !value.bands.length) return false;
    let previous = -1;
    let previousCents = -1;
    return value.bands.every((band, index) => {
      if (!record(band) || !amount(band.minUnits) || (index === 0 && band.minUnits !== 0)
        || band.minUnits <= previous || band.minUnits > Number(value.maxUnits)
        || !Number.isSafeInteger(band.customerCents) || Number(band.customerCents) < previousCents || Number(band.customerCents) < 0) return false;
      previous = band.minUnits;
      previousCents = Number(band.customerCents);
      return true;
    });
  }
  if (value.rounding !== 'up' && value.rounding !== 'nearest') return false;
  if (value.kind === 'unit_terms') return terms(value.terms, false, false);
  if (value.kind !== 'unit_components' || !Array.isArray(value.components) || !value.components.length) return false;
  const ids = new Set<string>();
  return value.components.every((component) => {
    if (!record(component) || typeof component.id !== 'string' || !component.id.trim() || ids.has(component.id) ||
        !amount(component.flatCents) || !['none', 'up', 'nearest'].includes(String(component.rounding)) ||
        (component.precision !== undefined && !precision(component.precision)) || !terms(component.terms, true, true)) return false;
    ids.add(component.id);
    return true;
  });
}

export function manualTariffUnitNames(price: ManualTariffPrice): string[] {
  if (price.kind === 'fixed') return [];
  const allTerms = price.kind === 'unit_terms' || price.kind === 'unit_bands' ? price.terms : price.components.flatMap((component) => component.terms);
  return [...new Set(allTerms.map((term) => term.unit))];
}

export function roundManualTariffAmount(value: number, rounding: 'none' | 'up' | 'nearest'): number {
  return rounding === 'none' ? value : rounding === 'up' ? Math.ceil(value - 1e-9) : Math.round(value);
}

export function normalizeManualTariffUnits(quantity: number, rule: ManualTariffUnitNormalization): number {
  let value = Math.max(0, quantity - (rule.includedUnits ?? 0));
  for (const step of rule.steps) {
    if (step.operation === 'multiply') value *= step.amount;
    else if (step.operation === 'divide') value /= step.amount;
    else if (step.operation === 'add') value += step.amount;
    else if (step.operation === 'decimal') value = Number(value.toFixed(step.precision));
    else if (step.operation === 'round') value = roundManualTariffAmount(value, step.rounding);
  }
  return value;
}

export function evaluateManualTariffPrice(price: ManualTariffPrice, quantities: Readonly<Record<string, number>>) {
  if (price.kind === 'fixed') return { exactCustomerCents: price.customerCents, customerTotalCents: price.customerCents, units: [] };
  const units: { unit: string; quantity: number; centsPerUnit: number; componentId?: string; billedQuantity?: number; normalizedQuantity?: number }[] = [];
  if (price.kind === 'unit_bands') {
    units.push(...price.terms.map(term => ({ ...term, quantity: quantities[term.unit] })));
    const weightedUnits = units.reduce((sum, term) => sum + term.centsPerUnit * term.quantity, 0) / price.divisor;
    if (!Number.isFinite(weightedUnits) || weightedUnits < 0 || weightedUnits > price.maxUnits) {
      throw new RangeError('Authored unit-band quantities are outside their reviewed range.');
    }
    let lower = 0;
    let upper = price.bands.length;
    while (lower + 1 < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (price.bands[middle].minUnits <= weightedUnits) lower = middle;
      else upper = middle;
    }
    const customerTotalCents = price.bands[lower].customerCents;
    return { exactCustomerCents: customerTotalCents, customerTotalCents, units };
  }
  let exactCustomerCents: number;
  if (price.kind === 'unit_terms') {
    units.push(...price.terms.map((term) => ({ ...term, quantity: quantities[term.unit] })));
    exactCustomerCents = units.reduce((sum, term) => sum + term.centsPerUnit * term.quantity, 0);
  } else {
    exactCustomerCents = price.components.reduce((total, component) => {
      let componentAmount = component.flatCents;
      for (const term of component.terms) {
        const quantity = quantities[term.unit];
        const rule = term.quantityRounding;
        const native = term.quantityNormalization;
        const chargeableQuantity = Math.max(0, quantity - (native?.includedUnits ?? term.includedUnits ?? 0));
        const normalized = native ? normalizeManualTariffUnits(quantity, native) : undefined;
        const billedQuantity = native ? normalized! / native.denominator
          : rule ? Math.round(chargeableQuantity * rule.scale * 10 ** rule.precision) / 10 ** rule.precision / rule.scale : chargeableQuantity;
        // Convert the authored unit rate before multiplication. Reordering these
        // operations changes cents for large, still valid trusted quantities.
        componentAmount += native ? (term.centsPerUnit / native.denominator) * normalized! : term.centsPerUnit * billedQuantity;
        units.push({ unit: term.unit, centsPerUnit: term.centsPerUnit, quantity, componentId: component.id,
          ...(native ? { billedQuantity: chargeableQuantity, normalizedQuantity: billedQuantity }
            : rule || term.includedUnits !== undefined ? { billedQuantity } : {}) });
      }
      if (component.precision !== undefined) componentAmount = Math.round(componentAmount * 10 ** component.precision) / 10 ** component.precision;
      return total + roundManualTariffAmount(componentAmount, component.rounding);
    }, 0);
  }
  return { exactCustomerCents, customerTotalCents: roundManualTariffAmount(exactCustomerCents, price.rounding), units };
}
