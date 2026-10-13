import type { PricingContext } from '../../frontend/src/lib/pricing-context';
import { ENV } from '../../frontend/src/lib/env';
import { tariffReaderActor, tariffSelectorKey, withTariffReaderFixture } from './customer-tariff-reader-fixture';
import { reviewedLasPricingState } from './seedance-las-pricing-fixture';

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
