import type { ManualTariffPrice } from '@maxvideoai/pricing';
import { adjacentNonnegativeDouble } from './pricing-number-boundaries';

/** Migration-only: capture every cent transition, including its first representable double. */
export function compileBoundedUnitBands(input: {
  terms: Extract<ManualTariffPrice, { kind: 'unit_bands' }>['terms']; divisor: number; maxUnits: number;
  currentCents: (units: number) => number;
}): Extract<ManualTariffPrice, { kind: 'unit_bands' }> {
  const first = input.currentCents(0);
  const last = input.currentCents(input.maxUnits);
  if (!Number.isSafeInteger(first) || first < 0 || !Number.isSafeInteger(last) || last < first
    || last - first > 10000 || !Number.isFinite(input.maxUnits) || input.maxUnits <= 0) {
    throw new Error('Unsupported bounded customer-price range.');
  }
  const bands = [{ minUnits: 0, customerCents: first }];
  for (let cents = first + 1; cents <= last; cents++) {
    let lower = 0;
    let upper = input.maxUnits;
    while (adjacentNonnegativeDouble(lower, 'next') < upper) {
      const middle = lower + (upper - lower) / 2;
      if (middle === lower || middle === upper) break;
      if (input.currentCents(middle) >= cents) upper = middle;
      else lower = middle;
    }
    const customerCents = input.currentCents(upper);
    if (customerCents < cents || input.currentCents(adjacentNonnegativeDouble(upper, 'previous')) >= cents) {
      throw new Error('Unable to certify an exact customer-price boundary.');
    }
    if (bands[bands.length - 1].minUnits !== upper) bands.push({ minUnits: upper, customerCents });
  }
  return { kind: 'unit_bands', terms: input.terms, divisor: input.divisor, maxUnits: input.maxUnits, bands };
}
