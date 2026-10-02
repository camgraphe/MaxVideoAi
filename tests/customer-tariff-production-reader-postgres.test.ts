import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import document from '../frontend/config/customer-tariffs.json';
import { createQueryExecutor, getDb, withDbTransaction } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { customerTariffsEnabledByCode, upsertCustomerTariffCell } from '../frontend/server/pricing/customer-tariff-store';
import { CustomerTariffUnavailableError } from '../frontend/server/pricing/resolve-customer-tariff';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

test('the authored production switch preserves the separate development socket gate', () => {
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  const active = document.active;
  try {
    document.active = true;
    Object.assign(process.env, { NODE_ENV: 'production', PRICING_SANDBOX: '0' });
    delete process.env.DATABASE_URL;
    assert.equal(customerTariffsEnabledByCode(), true, 'production must attempt the reader even without a configured DB');
    for (const runtime of ['development', 'test']) {
      Object.assign(process.env, { NODE_ENV: runtime, PRICING_SANDBOX: '0' });
      assert.equal(customerTariffsEnabledByCode(), false);
    }
    Object.assign(process.env, { NODE_ENV: 'development', PRICING_SANDBOX: '1' });
    for (const url of [
      'postgresql://fixture@ep-fixture.eu-central-1.aws.neon.tech/fixture',
      'postgresql://fixture@localhost/fixture',
      'postgresql://fixture@localhost/fixture?host=%2Ftmp%2Ffixture&sslmode=disable',
    ]) {
      process.env.DATABASE_URL = url;
      assert.equal(customerTariffsEnabledByCode(), false);
    }
    process.env.DATABASE_URL = 'postgresql://fixture@localhost/fixture?host=%2Ftmp%2Ffixture';
    assert.equal(customerTariffsEnabledByCode(), true);
  } finally {
    document.active = active;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('production default reader uses inactive legacy prices, then exact active prices, and refuses missing data', async () => {
  assert.equal(document.active, true, 'this release must enable the authored production reader');
  const database = await startDisposablePostgres('production-tariff-reader');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: database.databaseUrl, NODE_ENV: 'test', PRICING_SANDBOX: '0' });
  const appPool = getDb();
  try {
    await createPaidGenerationTestSchema(database.pool);
    for (const name of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await database.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    const scenario = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'pika-text-to-video')!;
    assert.ok(scenario);
    const policy = await loadPricingPolicyOverridesWithExecutor(createQueryExecutor(database.pool));
    const quote = () => computeCanonicalBillingSnapshot(scenario.context, {
      pricingPolicy: { loadOverrides: async () => policy },
    });
    const legacy = await quote();
    assert.notEqual(legacy.meta?.pricingMode, 'manual_tariff');
    process.env.NODE_ENV = 'production';
    const inactive = await quote();
    assert.equal(inactive.totalCents, legacy.totalCents);
    assert.notEqual(inactive.meta?.pricingMode, 'manual_tariff');

    await withDbTransaction(async executor => {
      await upsertCustomerTariffCell(executor, {
        id: 'production-reader-fixture', selector: scenario.selector, currency: 'USD', source: 'database', version: 1,
        effectiveFrom: '2026-09-29T00:00:00Z', price: { kind: 'fixed', customerCents: 37 },
      }, '11111111-1111-4111-8111-111111111111');
      await executor.query('UPDATE app_customer_tariff_state SET active=TRUE WHERE singleton=TRUE');
    });
    const active = await quote();
    assert.equal(active.totalCents, 37);
    assert.equal(active.meta?.pricingMode, 'manual_tariff');
    assert.equal(active.meta?.customerTariffRevision, 1);
    assert.equal(active.meta?.customerTariffCellId, 'production-reader-fixture');

    await database.pool.query('DELETE FROM app_customer_tariff_cells');
    await assert.rejects(quote(), error => (error as { code?: string }).code === 'missing_cell');
    await database.pool.query('ALTER TABLE app_customer_tariff_state RENAME TO unavailable_tariff_state');
    await assert.rejects(quote(), CustomerTariffUnavailableError);
    delete process.env.DATABASE_URL;
    await assert.rejects(quote(), CustomerTariffUnavailableError);
  } finally {
    await appPool.end().catch(() => undefined);
    await database.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
