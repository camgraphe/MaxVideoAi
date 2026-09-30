import { isValidManualTariffPrice, manualTariffUnitNames, quoteCanonicalManualTariff, type ManualTariffPrice } from '@maxvideoai/pricing';
import { buildBillingPricingFacts } from '@/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousWan3TariffSelector } from '@/lib/pricing-manual-scenario';
import type { PricingContext } from '@/lib/pricing-context';

function nextPositive(value: number): number {
  if (value === 0) return Number.MIN_VALUE;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value);
  view.setBigUint64(0, view.getBigUint64(0) + BigInt(1));
  return view.getFloat64(0);
}

/**
 * Both authored nonnegative components and Wan supplier facts are monotone in input seconds.
 * Supplier ceil cents are constant between their jumps: the least customer price in each
 * interval is its first representable duration. Checking those points covers the whole range.
 */
export function validateWan3ContinuousTariffDomain(input: { context: PricingContext; price: ManualTariffPrice }): {
  maxInputSeconds: number; checkedBoundaries: number; minimumGrossCents: number;
} {
  if (!isValidManualTariffPrice(input.price) || input.price.kind === 'fixed' ||
      !manualTariffUnitNames(input.price).includes('input_video_seconds') ||
      manualTariffUnitNames(input.price).some(unit => unit !== 'input_video_seconds')) {
    throw new Error('Invalid continuous input-second tariff units.');
  }
  const at = '2026-09-30T00:00:00.000Z';
  const maxInputSeconds = Math.min(15, 30 - input.context.durationSec);
  if (!Number.isFinite(maxInputSeconds) || maxInputSeconds <= 0) throw new Error('Unsupported continuous Wan duration range.');
  const factsAt = (seconds: number) => buildBillingPricingFacts({ ...input.context, inputVideoDurationSec: seconds }, input.context.engine.pricingDetails, 'USD').facts;
  const initialFacts = factsAt(Number.MIN_VALUE);
  const selector = continuousWan3TariffSelector(buildManualTariffScenario({ ...input.context, inputVideoDurationSec: Number.MIN_VALUE }, initialFacts).selector);
  if (!selector) throw new Error('Unsupported continuous Wan duration.');
  const supplierCents = (seconds: number) => Math.ceil(factsAt(seconds).vendorSubtotalExactCents - 1e-9);
  let checkedBoundaries = 0;
  let minimumGrossCents = Infinity;
  const check = (seconds: number) => {
    const quote = quoteCanonicalManualTariff({ facts: factsAt(seconds), selector, scenarioId: 'continuous-domain',
      quantities: { input_video_seconds: seconds }, at, databaseCells: [], versionedCells: [{
        id: 'candidate', selector, price: input.price, source: 'versioned', version: 1, currency: 'USD', effectiveFrom: at,
      }] });
    minimumGrossCents = Math.min(minimumGrossCents, quote.platformFeeCents);
    checkedBoundaries++;
  };
  check(Number.MIN_VALUE);
  check(maxInputSeconds);
  const last = supplierCents(maxInputSeconds);
  const first = supplierCents(Number.MIN_VALUE);
  if (last - first > 10_000) throw new Error('Unsupported continuous Wan cost range.');
  for (let cents = first + 1; cents <= last; cents++) {
    let lower = Number.MIN_VALUE;
    let upper = maxInputSeconds;
    while (nextPositive(lower) < upper) {
      const middle = lower + (upper - lower) / 2;
      if (middle === lower || middle === upper) break;
      if (supplierCents(middle) >= cents) upper = middle;
      else lower = middle;
    }
    check(upper);
  }
  return { maxInputSeconds, checkedBoundaries, minimumGrossCents };
}
