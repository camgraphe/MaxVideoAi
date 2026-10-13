import type { PricingContext } from '../../frontend/src/lib/pricing-context';
import { buildBillingPricingFacts } from '../../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario, continuousInputTariffSelector } from '../../frontend/src/lib/pricing-manual-scenario';
import { ENV } from '../../frontend/src/lib/env';
import { tariffReaderActor, tariffSelectorKey, withTariffReaderFixture } from './customer-tariff-reader-fixture';

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

/** Real canonical reader fixture; readiness keys do not submit any provider task. */
export async function withReviewedLasPreflightFixture(context: PricingContext, work: () => Promise<void>) {
  const flags = { BYTEPLUS_ARK_ENABLED: 'true', BYTEPLUS_ARK_API_KEY: 'test-ark-key', SEEDANCE_2_5_BYTEPLUS_ENABLED: 'true',
    SEEDANCE_2_5_PROVIDER: 'byteplus_modelark', SEEDANCE_2_5_BYTEPLUS_ADMIN_ONLY: 'false',
    SEEDANCE_2_5_BYTEPLUS_MODES: 't2v,i2v,ref2v,v2v,extend',
    SEEDANCE_2_5_LAS_ENABLED: 'true', BYTEPLUS_LAS_API_KEY: 'test-las-key' };
  const before = Object.fromEntries(Object.keys(flags).map(key => [key, ENV[key as keyof typeof ENV]]));
  Object.assign(ENV, flags);
  try {
    await withTariffReaderFixture(async ({ database }) => {
      const cell = reviewedLasPricingState(context).databaseCells[0];
      await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
      await database.pool.query(`INSERT INTO app_customer_tariff_cells
        (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
        VALUES ($1,$2,$3::jsonb,$4::jsonb,'USD',$5,1,$6)`,
      [cell.id, tariffSelectorKey(cell.selector), JSON.stringify(cell.selector), JSON.stringify(cell.price), cell.effectiveFrom, tariffReaderActor]);
      await work();
    });
  } finally { Object.assign(ENV, before); }
}
