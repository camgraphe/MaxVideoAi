import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import type { ManualTariffSelector } from '@maxvideoai/pricing';
import * as store from '../frontend/server/pricing/customer-tariff-store';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { tariffReaderActor, tariffSelectorKey, withTariffReaderFixture } from './helpers/customer-tariff-reader-fixture';
import { createQueryExecutor } from '../frontend/src/lib/db';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { computeCurrentPublicSnapshot } from '../frontend/server/pricing/quote-public';

const first: ManualTariffSelector = { engineId: 'pika-text-to-video', mode: 't2v', durationSec: '5', resolution: '720p' };
const second = { ...first, durationSec: '10' };

async function insert(pool: Parameters<Parameters<typeof withTariffReaderFixture>[0]>[0]['database']['pool'], id: string, selector: ManualTariffSelector, historical = false) {
  await pool.query(`INSERT INTO ${historical ? 'app_customer_tariff_cell_versions' : 'app_customer_tariff_cells'}
    (${historical ? 'tariff_id' : 'id'},selector_key,selector_json,price_json,currency,effective_from,effective_until,revision,updated_by)
    VALUES ($1,$2,$3,$4,'USD',$5,$6,$7,$8)`,
  [id, tariffSelectorKey(selector), selector, { kind: 'fixed', customerCents: historical ? 40 : 60 },
    historical ? '2025-01-01' : '2026-01-01', historical ? '2026-01-01' : null, historical ? 1 : 2, tariffReaderActor]);
}

test('concurrent selected tariff reads share four SQL commands and preserve exact reader results', async () => {
  assert.equal(typeof store.createScopedCustomerTariffQuoteLoader, 'function');
  await withTariffReaderFixture(async ({ database, commands }) => {
    await insert(database.pool, 'b-current', first);
    await insert(database.pool, 'a-history', first, true);
    await insert(database.pool, 'c-current', second);
    await insert(database.pool, 'unrelated', { ...first, resolution: '1080p' });
    await database.pool.query("UPDATE app_customer_tariff_cells SET price_json='{}' WHERE id='unrelated'");
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=2');
    const expected = await Promise.all([first, second, { ...first, durationSec: '6' }].map(selector => store.loadCustomerTariffQuoteState(selector)));
    commands.length = 0;
    const read = store.createScopedCustomerTariffQuoteLoader();
    const actual = await Promise.all([read(first), read(second), read({ ...first, durationSec: '6' }), read(first)]);
    assert.deepEqual(actual.slice(0, 3), expected);
    assert.deepEqual(actual[3], expected[0]);
    assert.equal(commands.length, 4, 'one BEGIN, state SELECT, selected rows SELECT and COMMIT for every concurrent quote');
    assert.equal(commands[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.equal(commands.at(-1), 'COMMIT');
    assert.ok(commands.every(sql => !/LOCK TABLE|INSERT|UPDATE|DELETE/.test(sql)), 'the public batch never takes maintenance locks or writes');
    if (actual[0].status === 'loaded' && actual[3].status === 'loaded') {
      actual[0].databaseCells[0].selector.engineId = 'changed';
      assert.equal(actual[3].databaseCells[0].selector.engineId, first.engineId, 'duplicate callers get isolated data');
    }
    await database.pool.query(`UPDATE app_customer_tariff_cells SET price_json='{"kind":"fixed","customerCents":75}' WHERE id='b-current'`);
    await database.pool.query('UPDATE app_customer_tariff_state SET revision=3');
    const fresh = await read(first);
    assert.equal(fresh.status, 'loaded');
    if (fresh.status === 'loaded') {
      assert.equal(fresh.revision, 3);
      assert.deepEqual(fresh.databaseCells.at(-1)?.price, { kind: 'fixed', customerCents: 75 });
    }
  });
});

test('batched continuous and exact selectors retain ordered history and isolate malformed selected rows', async () => {
  assert.equal(typeof store.loadCustomerTariffQuoteStates, 'function');
  await withTariffReaderFixture(async ({ database, commands }) => {
    const scenario = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'lumaRay2' && row.context.mode === 'v2v')!;
    const continuous = continuousInputTariffSelector(scenario.selector)!;
    assert.ok(continuous);
    await insert(database.pool, 'a-history', continuous, true);
    await insert(database.pool, 'b-continuous', continuous);
    await insert(database.pool, 'c-exact', scenario.selector);
    await insert(database.pool, 'bad-selected', first);
    await database.pool.query("UPDATE app_customer_tariff_cells SET price_json='{}' WHERE id='bad-selected'");
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=2');
    const expected = await store.loadCustomerTariffQuoteState(scenario.selector);
    commands.length = 0;
    const [valid, invalid] = await store.loadCustomerTariffQuoteStates([scenario.selector, first]);
    assert.deepEqual(valid, expected);
    assert.deepEqual(invalid, { status: 'unavailable' });
    assert.equal(commands.length, 4);
    commands.length = 0;
    assert.deepEqual(await store.loadCustomerTariffQuoteStates([]), []);
    assert.deepEqual(commands, []);
    await database.pool.query('ALTER TABLE app_customer_tariff_cell_versions RENAME TO held_history');
    assert.deepEqual(await store.loadCustomerTariffQuoteStates([first, second]), [{ status: 'unavailable' }, { status: 'unavailable' }]);
    assert.equal(commands.at(-1), 'ROLLBACK');
    await database.pool.query('UPDATE app_customer_tariff_state SET active=FALSE');
    const inactive = await store.loadCustomerTariffQuoteState(second);
    assert.deepEqual(await store.loadCustomerTariffQuoteStates([second]), [inactive], 'inactive tariffs do not require the history table');
  });
});

test('watch context batches canonical current quotes without changing any snapshot fields', async () => {
  const react = createRequire(import.meta.url)('react');
  const cache = react.cache;
  if (!cache) react.cache = (fn: unknown) => fn;
  let loader: typeof import('../frontend/server/example-watch-detail-loader');
  try { loader = await import('../frontend/server/example-watch-detail-loader'); }
  finally { if (!cache) delete react.cache; }
  await withTariffReaderFixture(async ({ database, commands }) => {
    const coverage = collectSellableManualTariffCoverage().scenarios.filter(row => row.modelId === 'pika-text-to-video');
    const scenarios = [coverage[0], coverage.find(row => tariffSelectorKey(row.selector) !== tariffSelectorKey(coverage[0].selector))!];
    assert.ok(scenarios.every(Boolean));
    for (const [index, scenario] of scenarios.entries()) await insert(database.pool, `watch-${index}`, scenario.selector);
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=2');
    const policy = await loadPricingPolicyOverridesWithExecutor(createQueryExecutor(database.pool));
    const expected = await Promise.all(scenarios.map(scenario => computeCurrentPublicSnapshot(scenario.context, {
      pricingPolicy: { loadOverrides: async () => policy },
    })));
    const context = await loader.prepareExampleWatchDetailContext({
      loadEngines: async () => [scenarios[0].context.engine], loadOverrides: async () => policy,
    });
    commands.length = 0;
    const actual = await Promise.all(scenarios.map(scenario => context.quote(scenario.context)));
    assert.deepEqual(actual, expected);
    assert.equal(actual[0].totalCents, 60);
    assert.equal(commands.length, 4, 'the actual watch provider must use the scoped selected reader');
    await database.pool.query(`UPDATE app_customer_tariff_cells SET price_json='{"kind":"fixed","customerCents":75}' WHERE id='watch-0'`);
    await database.pool.query('UPDATE app_customer_tariff_state SET revision=3');
    const fresh = await context.quote(scenarios[0].context);
    assert.equal(fresh.totalCents, 75);
    const expectedFresh = await computeCurrentPublicSnapshot(scenarios[0].context, {
      pricingPolicy: { loadOverrides: async () => policy },
    });
    assert.equal(expectedFresh.meta?.customerTariffRevision, 3);
    assert.deepEqual(fresh, expectedFresh);
    await database.pool.query('ALTER TABLE app_customer_tariff_state RENAME TO unavailable_tariff_state');
    await assert.rejects(() => context.quote(scenarios[0].context), { name: 'CustomerTariffUnavailableError' });
  });
});

test('batch reads one consistent revision across concurrent tariff edits and observes later changes', async () => {
  assert.equal(typeof store.createScopedCustomerTariffQuoteLoader, 'function');
  await withTariffReaderFixture(async fixture => {
    await insert(fixture.database.pool, 'current', first);
    await fixture.database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=2');
    let edited = false;
    fixture.beforeQuery = async sql => {
      if (!edited && sql.includes('FROM app_customer_tariff_cell_versions')) {
        edited = true;
        const writer = await fixture.database.pool.connect();
        try {
          await writer.query('BEGIN');
          await writer.query('UPDATE app_customer_tariff_state SET revision=3');
          await writer.query(`UPDATE app_customer_tariff_cells SET price_json='{"kind":"fixed","customerCents":80}',revision=3`);
          await writer.query('COMMIT');
        } finally { writer.release(); }
      }
    };
    const read = store.createScopedCustomerTariffQuoteLoader();
    const [old] = await Promise.all([read(first), read(second)]);
    assert.equal(old.status, 'loaded');
    if (old.status === 'loaded') {
      assert.equal(old.revision, 2);
      assert.deepEqual(old.databaseCells[0].price, { kind: 'fixed', customerCents: 60 });
    }
    fixture.beforeQuery = undefined;
    const next = await read(first);
    assert.equal(next.status, 'loaded');
    if (next.status === 'loaded') {
      assert.equal(next.revision, 3);
      assert.deepEqual(next.databaseCells[0].price, { kind: 'fixed', customerCents: 80 });
    }
  });
});

