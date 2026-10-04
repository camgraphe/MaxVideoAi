import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createQueryExecutor, withDbTransaction } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { loadCustomerTariffQuoteState, withLockedCustomerTariffQuoteReadBatch } from '../frontend/server/pricing/customer-tariff-store';
import { createPaidGenerationTestSchema, startDisposablePostgres } from './helpers/disposable-postgres';

const key = (selector: object) => JSON.stringify(Object.entries(selector).sort(([a], [b]) => a.localeCompare(b)));

test('locked batch preserves the real selector reader while bounding database round trips', async () => {
  const db = await startDisposablePostgres('tariff-read-batch');
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const file of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    }
    const scenario = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'pika-text-to-video')!;
    await db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES ('batch-price',$1,$2,$3,'USD','2026-09-29',1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')`,
    [key(scenario.selector), scenario.selector, { kind: 'fixed', customerCents: 50 }]);
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
    const policy = await loadPricingPolicyOverridesWithExecutor(createQueryExecutor(db.pool));
    await withDbTransaction(async executor => {
      const normal = await loadCustomerTariffQuoteState(scenario.selector, executor);
      const query = executor.query.bind(executor);
      let queries = 0;
      executor.query = (sql, params) => { queries++; return query(sql, params); };
      await withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => {
        assert.deepEqual(await loadCustomerTariffQuoteState(scenario.selector, executor), normal);
        process.env.NODE_ENV = 'test';
        const disabled = await loadCustomerTariffQuoteState(scenario.selector, executor);
        assert.equal(disabled.status, 'loaded');
        if (disabled.status === 'loaded') assert.equal(disabled.active, false);
        process.env.NODE_ENV = 'production';
        for (let i = 0; i < 12; i++) {
          const quote = await computeCanonicalBillingSnapshot(scenario.context, {
            pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
          });
          assert.equal(quote.totalCents, 50);
          assert.equal(quote.meta?.customerTariffCellId, 'batch-price');
        }
        const returned = await loadCustomerTariffQuoteState(scenario.selector, executor);
        assert.equal(returned.status, 'loaded');
        if (returned.status !== 'loaded') throw new Error('Reader unavailable');
        if (returned.databaseCells[0].price.kind !== 'fixed') throw new Error('Expected fixed price');
        returned.databaseCells[0].price.customerCents = 999;
        (returned.databaseCells[0].selector as Record<string, string>).engineId = 'mutated';
        assert.deepEqual(await loadCustomerTariffQuoteState(scenario.selector, executor), normal);
        await assert.rejects(withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => undefined), /scope|batch/i);
      });
      assert.ok(queries <= 4, `A locked batch made ${queries} database requests`);
      await executor.query('UPDATE app_customer_tariff_cells SET price_json=$1', [{ kind: 'fixed', customerCents: 51 }]);
      const fresh = await computeCanonicalBillingSnapshot(scenario.context, {
        pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
      });
      assert.equal(fresh.totalCents, 51, 'completed batch must not leak a stale price');
      const fakeKey = { ...scenario.selector, engineId: 'not-warmed' };
      await withLockedCustomerTariffQuoteReadBatch(executor, [fakeKey], async () => {
        const outside = await loadCustomerTariffQuoteState(scenario.selector, executor);
        assert.equal(outside.status, 'loaded');
        if (outside.status === 'loaded') assert.deepEqual(outside.databaseCells[0].price, { kind: 'fixed', customerCents: 51 });
        await assert.rejects(Promise.resolve().then(() => { throw new Error('callback failed'); }), /callback failed/);
      });
      await assert.rejects(withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => {
        throw new Error('batch callback failed');
      }), /batch callback failed/);
      await withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => {
        assert.equal((await loadCustomerTariffQuoteState(scenario.selector, executor)).status, 'loaded');
      });
    }, { pool: db.pool });

    // SQL selects by the stored key. A cache must not "repair" that key from JSON.
    await db.pool.query('UPDATE app_customer_tariff_cells SET selector_key=$1', [key({ ...scenario.selector, engineId: 'misbound' })]);
    await withDbTransaction(async executor => {
      await withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => {
        await assert.rejects(computeCanonicalBillingSnapshot(scenario.context, {
          pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
        }), error => (error as { code?: string }).code === 'missing_cell');
      });
    }, { pool: db.pool });
    await assert.rejects(withLockedCustomerTariffQuoteReadBatch(createQueryExecutor(db.pool) as never,
      [scenario.selector], async () => undefined), /transaction/i);
  } finally {
    await db.cleanup();
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

test('batch reservations, historical overlaps and missing schema remain fail closed', async () => {
  const db = await startDisposablePostgres('tariff-read-batch-scope');
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const file of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    }
    const scenario = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'pika-text-to-video')!;
    const policy = await loadPricingPolicyOverridesWithExecutor(createQueryExecutor(db.pool));
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=2');
    await db.pool.query(`INSERT INTO app_customer_tariff_cell_versions
      (tariff_id,selector_key,selector_json,price_json,currency,effective_from,effective_until,revision,updated_by)
      SELECT 'overlap',$1,$2,$3,'USD','2026-01-01','2099-01-01',n,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid FROM generate_series(1,2) AS n`,
    [key(scenario.selector), scenario.selector, { kind: 'fixed', customerCents: 50 }]);
    let escaped: Parameters<typeof loadCustomerTariffQuoteState>[1];
    await withDbTransaction(async executor => {
      escaped = executor;
      const first = withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => {
        const state = await loadCustomerTariffQuoteState(scenario.selector, executor);
        assert.equal(state.status, 'loaded');
        if (state.status === 'loaded') assert.equal(state.databaseCells.length, 2);
        await assert.rejects(computeCanonicalBillingSnapshot(scenario.context, {
          pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
        }), error => (error as { code?: string }).code === 'ambiguous_cell');
      });
      await assert.rejects(withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => undefined), /scope|batch/i);
      await first;
    }, { pool: db.pool });
    assert.equal((await loadCustomerTariffQuoteState(scenario.selector, escaped)).status, 'unavailable');
    // Even a still-warmed scope cannot outlive the branded transaction.
    let release!: () => void;
    let ready!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const prepared = new Promise<void>(resolve => { ready = resolve; });
    let pending!: Promise<void>;
    await withDbTransaction(async executor => {
      escaped = executor;
      pending = withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => {
        ready();
        await held;
      });
      await prepared;
    }, { pool: db.pool });
    try {
      assert.equal((await loadCustomerTariffQuoteState(scenario.selector, escaped)).status, 'unavailable');
    } finally {
      release();
      await pending;
    }
    await db.pool.query('ALTER TABLE app_customer_tariff_state RENAME TO missing_state');
    let callbackRan = false;
    await assert.rejects(withDbTransaction(executor => withLockedCustomerTariffQuoteReadBatch(executor,
      [scenario.selector], async () => { callbackRan = true; }), { pool: db.pool }),
      error => (error as { code?: string }).code === '42P01');
    assert.equal(callbackRan, false);
  } finally {
    await db.cleanup();
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});


test('continuous selectors keep canonical quantity pricing and block concurrent tariff writes', async () => {
  const db = await startDisposablePostgres('batch-continuous');
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await createPaidGenerationTestSchema(db.pool);
    for (const file of ['27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await db.pool.query(readFileSync(`neon/migrations/${file}`, 'utf8'));
    }
    const scenario = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'lumaRay2' && row.context.mode === 'v2v')!;
    assert.ok(scenario);
    const selector = { ...scenario.selector, durationSec: 'continuous' };
    await db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id,selector_key,selector_json,price_json,currency,effective_from,revision,updated_by)
      VALUES ('continuous-price',$1,$2,$3,'USD','2026-09-29',1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')`,
    [key(selector), selector, { kind: 'unit_components', rounding: 'up', components: [
      { id: 'output', flatCents: 10, rounding: 'none', terms: [{ unit: 'output_seconds', centsPerUnit: 200 }] },
    ] }]);
    await db.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
    const policy = await loadPricingPolicyOverridesWithExecutor(createQueryExecutor(db.pool));
    await withDbTransaction(async executor => {
      const normal = await computeCanonicalBillingSnapshot(scenario.context, {
        pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
      });
      await withLockedCustomerTariffQuoteReadBatch(executor, [scenario.selector], async () => {
        const batched = await computeCanonicalBillingSnapshot(scenario.context, {
          pricingPolicy: { loadOverrides: async () => policy }, customerTariffExecutor: executor,
        });
        assert.equal(batched.totalCents, normal.totalCents);
        assert.equal(batched.meta?.customerTariffCellId, 'continuous-price');
        const writer = await db.pool.connect();
        try {
          await writer.query('BEGIN');
          await writer.query("SET LOCAL lock_timeout='200ms'");
          await assert.rejects(writer.query('UPDATE app_customer_tariff_state SET revision=2'),
            error => (error as { code?: string }).code === '55P03');
        } finally {
          await writer.query('ROLLBACK');
          writer.release();
        }
      });
    }, { pool: db.pool });
    await db.pool.query('UPDATE app_customer_tariff_state SET revision=2');
  } finally {
    await db.cleanup();
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});
