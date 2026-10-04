import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { customerTariffCellId } from '../frontend/server/pricing/customer-tariff-seed';
import { upsertCustomerTariffCell } from '../frontend/server/pricing/customer-tariff-store';

test('cutover canonical reader sees the uncommitted candidate on its locked transaction and never the old connection', async () => {
  const db = await startDisposablePostgres('pricing-cutover-reader');
  const before = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const name of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql', '58_customer_tariff_bulk_interval_lock.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${name}`, 'utf8'));
    }
    const scenario = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'pika-text-to-video')!;
    await assert.rejects(withDbTransaction(async executor => {
      const policy = await loadPricingPolicyOverridesWithExecutor(executor);
      await upsertCustomerTariffCell(executor, { id: customerTariffCellId(scenario.id), selector: scenario.selector,
        currency: 'USD', source: 'database', version: 1, effectiveFrom: '2026-09-29T00:00:00Z',
        price: { kind: 'fixed', customerCents: 37 } }, '11111111-1111-4111-8111-111111111111');
      await executor.query('UPDATE app_customer_tariff_state SET active=TRUE WHERE singleton=TRUE');
      const quote = await computeCanonicalBillingSnapshot(scenario.context, {
        pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
      });
      assert.equal(quote.totalCents, 37);
      assert.equal(quote.meta?.pricingMode, 'manual_tariff');
      assert.equal(quote.meta?.customerTariffRevision, 1);
      throw new Error('ROLLBACK_READER_PROBE');
    }), /ROLLBACK_READER_PROBE/);
    assert.deepEqual((await db.pool.query('SELECT revision,active FROM app_customer_tariff_state')).rows, [{ revision: '0', active: false }]);
    assert.equal((await db.pool.query('SELECT count(*)::int AS n FROM app_customer_tariff_cells')).rows[0].n, 0);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(before)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
