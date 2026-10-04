import { isValidManualTariffPrice, manualTariffUnitNames, quoteCanonicalManualTariff,
  type ManualTariffPrice, type ManualTariffSelector, type PricingFacts } from '@maxvideoai/pricing';

function nextPositive(value: number): number {
  if (value === 0) return Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(1));
  return view.getFloat64(0);
}

/** Monotone authored amounts: worst gross in a supplier-cent interval is at its first double. */
export function validateMonotoneContinuousTariffDomain(input: {
  price: ManualTariffPrice; selector: ManualTariffSelector; unit: string;
  minimum: number; maximum: number; factsAt: (seconds: number) => PricingFacts;
}) {
  const { minimum, maximum, factsAt, price, selector, unit } = input;
  if (!isValidManualTariffPrice(price) || price.kind === 'fixed' || !manualTariffUnitNames(price).includes(unit)
    || manualTariffUnitNames(price).some(name => name !== unit)) throw new Error('Invalid continuous input-second tariff units.');
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum < minimum) {
    throw new Error('Unsupported continuous duration range.');
  }
  const at = '2026-09-30T00:00:00.000Z';
  const supplierCents = (seconds: number) => Math.ceil(factsAt(seconds).vendorSubtotalExactCents - 1e-9);
  let checkedBoundaries = 0;
  let minimumGrossCents = Infinity;
  const check = (seconds: number) => {
    const quote = quoteCanonicalManualTariff({ facts: factsAt(seconds), selector, scenarioId: 'continuous-domain',
      quantities: { [unit]: seconds }, at, databaseCells: [], versionedCells: [{
        id: 'candidate', selector, price, source: 'versioned', version: 1, currency: 'USD', effectiveFrom: at,
      }] });
    minimumGrossCents = Math.min(minimumGrossCents, quote.platformFeeCents);
    checkedBoundaries++;
  };
  check(minimum);
  check(maximum);
  const first = supplierCents(minimum);
  const last = supplierCents(maximum);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last < first || last - first > 10_000) {
    throw new Error('Unsupported continuous supplier-cost range.');
  }
  for (let cents = first + 1; cents <= last; cents++) {
    let lower = minimum;
    let upper = maximum;
    while (nextPositive(lower) < upper) {
      const middle = lower + (upper - lower) / 2;
      if (middle === lower || middle === upper) break;
      if (supplierCents(middle) >= cents) upper = middle;
      else lower = middle;
    }
    check(upper);
  }
  return { maxInputSeconds: maximum, checkedBoundaries, minimumGrossCents };
}
