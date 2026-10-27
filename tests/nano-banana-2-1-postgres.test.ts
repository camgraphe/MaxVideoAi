import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';
import { getDb, withDbTransaction } from '../frontend/src/lib/db';
import { upsertCustomerTariffCell, loadCustomerTariffQuoteState } from '../frontend/server/pricing/customer-tariff-store';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { buildBillingPricingFacts } from '../frontend/src/lib/pricing-billing-facts';
import { buildManualTariffScenario } from '../frontend/src/lib/pricing-manual-scenario';

test('PG17 Nano21 exact new cells fail closed, bind the current version and preserve old paid receipts', async () => {
  const db = await startDisposablePostgres('nano21-tariff');
  const previous = { DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: process.env.NODE_ENV, PRICING_SANDBOX: process.env.PRICING_SANDBOX };
  Object.assign(process.env, { DATABASE_URL: db.databaseUrl, NODE_ENV: 'development', PRICING_SANDBOX: '1' });
  const engine = getFalEngineById('nano-banana-2-1')!.engine;
  const context = { engine, mode: 'i2i' as const, durationSec: 1, resolution: '4k', referenceImageCount: 14, thinkingLevel: 'high' };
  const selector = buildManualTariffScenario(context, buildBillingPricingFacts(context, undefined, 'USD').facts).selector;
  const deps = { pricingPolicy: { loadOverrides: async () => ({ status: 'loaded' as const, rules: [] }) } };
  const quote = (extra = {}) => computeCanonicalBillingSnapshot({ ...context, ...extra }, deps);
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const migration of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${migration}`, 'utf8'));
    }
    await db.pool.query(`INSERT INTO app_receipts (user_id,type,amount_cents,currency,job_id,surface,pricing_snapshot)
      VALUES ('fixture-owner','charge',41,'USD','old-nano2','image',$1::jsonb)`,
      [JSON.stringify({ totalCents: 41, engineId: 'nano-banana-2', meta: { customerTariffRevision: 7 } })]);
    const receipts = (await db.pool.query('SELECT * FROM app_receipts')).rows;
    await assert.rejects(quote(), /active reviewed Nano/);
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE WHERE singleton=TRUE');
    assert.equal((await quote()).totalCents,23,'the approved versioned 4K price is immediately usable through the active canonical reader');
    const cell = { id: 'synthetic-nano21-customer-cell', selector, currency: 'USD', source: 'database' as const,
      version: 1, effectiveFrom: '2026-10-25T00:00:00Z', price: { kind: 'fixed' as const, customerCents: 91 } };
    const actor = '11111111-1111-4111-8111-111111111111';
    await withDbTransaction(executor => upsertCustomerTariffCell(executor, cell, actor));
    const first = await quote();
    assert.equal(first.totalCents, 91);
    assert.equal(first.meta?.customerTariffCellId, cell.id);
    assert.equal(first.meta?.customerTariffRevision, 1);
    assert.equal(first.meta?.providerCostIncomplete, true);
    for (const extra of [{thinkingLevel:'medium'},{referenceImageCount:13},{maxOutputTokens:4096}]) {
      assert.equal((await quote(extra)).totalCents,91,'unpriced controls preserve the same current admin override');
    }
    assert.equal((await quote({resolution:'2k'})).totalCents,11,'another size reads its own approved fixed amount');
    await withDbTransaction(executor => upsertCustomerTariffCell(executor, { ...cell, version: 2,
      price: { kind: 'fixed', customerCents: 93 } }, actor));
    const current = await quote();
    assert.equal(current.totalCents, 93);
    assert.equal(current.meta?.customerTariffRevision, 2);
    const state = await loadCustomerTariffQuoteState(selector);
    assert.equal(state.status, 'loaded');
    if (state.status === 'loaded') assert.ok(state.databaseCells.some(cell => cell.version === 1), 'historical first cell revision remains readable');
    assert.deepEqual((await db.pool.query('SELECT * FROM app_receipts')).rows, receipts, 'new tariffs never rewrite paid Nano2 history');
    assert.equal(first.totalCents, 91, 'prepared snapshot object remains its original amount');
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
