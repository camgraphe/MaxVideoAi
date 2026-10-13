import type { PricingContext } from '../../frontend/src/lib/pricing-context';
import { buildBillingPricingFacts } from '../../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../../frontend/src/lib/pricing-manual-scenario';

/** Literal reviewed customer tariffs, independent of the provider-cost function under test. */
export function reviewedLasPricingState(context: PricingContext) {
  const rate = context.resolution === '480p' ? 30.7545 : context.resolution === '720p' ? 69.121875 : NaN;
  if (!Number.isFinite(rate)) throw new Error('Unsupported LAS fixture resolution');
  const facts = buildBillingPricingFacts(context, context.engine.pricingDetails, 'USD').facts;
  return { status: 'loaded' as const, active: true, revision: 1, versionedCells: [], databaseCells: [{
    id: 'reviewed-las-test', source: 'database' as const, version: 1, currency: 'USD', effectiveFrom: '2026-10-01T00:00:00Z',
    selector: continuousInputTariffSelector(buildManualTariffScenario(context, facts).selector)!,
    price: { kind: 'unit_components' as const, rounding: 'up' as const, components: [{ id: 'retail', rounding: 'none' as const,
      flatCents: context.durationSec * rate, terms: [{ unit: 'input_video_seconds', centsPerUnit: rate, includedUnits: 0 }] }] },
  }] };
}
