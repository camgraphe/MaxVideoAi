import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveManualTariffCell, type ManualTariffCell, type ManualTariffSelector } from '@maxvideoai/pricing';
import { createQueryExecutor, getDb, withDbTransaction } from '../frontend/src/lib/db';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { loadPricingPolicyOverridesWithExecutor } from '../frontend/src/lib/pricing-rule-store';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { loadCustomerTariffQuoteState, loadEffectiveCustomerTariffState, upsertCustomerTariffCell } from '../frontend/server/pricing/customer-tariff-store';
import { tariffReaderActor as actor, tariffSelectorKey as key, withTariffReaderFixture } from './helpers/customer-tariff-reader-fixture';

const exact: ManualTariffSelector = { engineId: 'pika-text-to-video', mode: 't2v', durationSec: '5', resolution: '720p' };
const makeCell = (id: string, selector = exact, version = 1, cents = 50,
  effectiveFrom = '2026-01-01T00:00:00.000Z', effectiveUntil?: string): ManualTariffCell => ({
  id, selector, source: 'database', version, currency: 'USD', effectiveFrom,
  ...(effectiveUntil ? { effectiveUntil } : {}), price: { kind: 'fixed', customerCents: cents },
});

async function insertCell(pool: Parameters<typeof createQueryExecutor>[0], cell: ManualTariffCell, historical = false) {
  await pool.query(`INSERT INTO ${historical ? 'app_customer_tariff_cell_versions' : 'app_customer_tariff_cells'}
    (${historical ? 'tariff_id' : 'id'},selector_key,selector_json,price_json,currency,effective_from,effective_until,revision,updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
  [cell.id, key(cell.selector), cell.selector, cell.price, cell.currency, cell.effectiveFrom,
    cell.effectiveUntil ?? null, cell.version, actor]);
}

test('active selected reader preserves every ordered row with two data commands and four transactional commands', async () => {
  await withTariffReaderFixture(async ({ database, commands }) => {
    const cells = [
      makeCell('b-history', exact, 10, 40, '2025-02-01T00:00:00.000Z', '2025-03-01T00:00:00.000Z'),
      makeCell('a-history', exact, 9, 30, '2025-02-01T00:00:00.000Z', '2025-03-01T00:00:00.000Z'),
      makeCell('a-history', exact, 2, 20, '2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z'),
      makeCell('z-current', exact, 11, 60, '2026-01-01T00:00:00.000Z'),
      makeCell('c-current', exact, 5, 50, '2025-03-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
    ];
    for (const [index, cell] of cells.entries()) await insertCell(database.pool, cell, index < 3);
    // An unrelated malformed row must never enter the exact quote read.
    await insertCell(database.pool, makeCell('unrelated', { ...exact, durationSec: '6' }));
    await database.pool.query(`UPDATE app_customer_tariff_cells SET price_json='{}' WHERE id='unrelated'`);
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=11');
    const expected = [cells[2], cells[1], cells[0], cells[4], cells[3]];
    const loaded = await loadCustomerTariffQuoteState(exact);
    assert.deepEqual(loaded, { status: 'loaded', revision: 11, active: true, versionedCells: [], databaseCells: expected });
    assert.equal(commands.length, 4, 'BEGIN + state + selected rows + COMMIT must execute on PG17');
    assert.equal(commands.filter(sql => sql.trimStart().startsWith('SELECT')).length, 2);
    assert.equal(commands[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    assert.equal(commands.at(-1), 'COMMIT');
    commands.length = 0;
    const client = await getDb().connect();
    try {
      const selected = await loadCustomerTariffQuoteState(exact, createQueryExecutor(client));
      assert.deepEqual(selected, loaded);
      assert.equal(commands.length, 2, 'a passed real PG17 executor runs exactly two selected data commands');
    } finally { client.release(); }
    // The explicit executor remains an existing caller-owned path.
    // Inventory reads retain separate SQL and validate unrelated rows.
    assert.deepEqual(await loadEffectiveCustomerTariffState(), { status: 'unavailable' });
    assert.equal(commands.at(-1), 'ROLLBACK');
    await database.pool.query(`UPDATE app_customer_tariff_cells SET price_json='{"kind":"fixed","customerCents":51}' WHERE id='unrelated'`);
    commands.length = 0;
    const inventory = await loadEffectiveCustomerTariffState();
    assert.equal(inventory.status, 'loaded');
    assert.equal(commands.length, 5, 'full admin inventory retains its original three data commands');
    if (inventory.status === 'loaded') assert.deepEqual(inventory.databaseCells.map(cell => cell.id),
      ['a-history', 'a-history', 'b-history', 'c-current', 'unrelated', 'z-current']);
  });
});

test('continuous lookup reads both stored selectors and history without neighboring options or key repair', async () => {
  await withTariffReaderFixture(async ({ database, commands }) => {
    const scenario = collectSellableManualTariffCoverage().scenarios.find(row => row.modelId === 'lumaRay2' && row.context.mode === 'v2v')!;
    assert.ok(scenario);
    const continuous = continuousInputTariffSelector(scenario.selector)!;
    const historical = makeCell('a-continuous', continuous, 1, 100, '2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z');
    const current = { ...makeCell('a-continuous', continuous, 2, 100, '2025-02-01T00:00:00.000Z'),
      price: { kind: 'unit_components' as const, rounding: 'up' as const, components: [
        { id: 'output', flatCents: 10, rounding: 'none' as const, terms: [{ unit: 'output_seconds', centsPerUnit: 200 }] },
      ] } };
    const point = makeCell('z-exact', scenario.selector, 3, 50000);
    await insertCell(database.pool, current);
    await insertCell(database.pool, historical, true);
    await insertCell(database.pool, point);
    await insertCell(database.pool, makeCell('neighbor', { ...continuous, resolution: 'unselected' }));
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=3');
    const state = await loadCustomerTariffQuoteState(scenario.selector);
    assert.deepEqual(state, { status: 'loaded', active: true, revision: 3, versionedCells: [], databaseCells: [historical, current, point] });
    assert.equal(commands.length, 4);
    const policy = await loadPricingPolicyOverridesWithExecutor(createQueryExecutor(database.pool));
    const quote = () => computeCanonicalBillingSnapshot(scenario.context, { pricingPolicy: { loadOverrides: async () => policy } });
    assert.equal((await quote()).meta?.customerTariffCellId, 'z-exact', 'exact point retains priority');
    await database.pool.query(`UPDATE app_customer_tariff_cells SET selector_key=$1 WHERE id='z-exact'`, [key({ ...scenario.selector, engineId: 'misbound' })]);
    assert.equal((await quote()).meta?.customerTariffCellId, 'a-continuous');
    await database.pool.query(`UPDATE app_customer_tariff_cells SET selector_key=$1 WHERE id='a-continuous'`, [key({ ...continuous, engineId: 'misbound' })]);
    await assert.rejects(quote(), error => (error as { code?: string }).code === 'missing_cell');
  });
});

test('selected active malformed rows and missing schema fail closed while inactive reads need no history', async () => {
  await withTariffReaderFixture(async ({ database, commands }) => {
    await insertCell(database.pool, makeCell('current'));
    await database.pool.query('ALTER TABLE app_customer_tariff_cell_versions RENAME TO held_history');
    assert.equal((await loadCustomerTariffQuoteState(exact)).status, 'loaded');
    assert.equal(commands.length, 4, 'inactive selected reads remain state + current only');
    assert.ok(commands.every(sql => !sql.includes('app_customer_tariff_cell_versions')));
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=1');
    assert.deepEqual(await loadCustomerTariffQuoteState(exact), { status: 'unavailable' });
    assert.equal(commands.at(-1), 'ROLLBACK');
    await database.pool.query('ALTER TABLE held_history RENAME TO app_customer_tariff_cell_versions');
    for (const [id, selector, price, revision] of [
      ['bad-price', exact, {}, 1],
      ['bad-selector', { engineId: '', mode: 't2v' }, { kind: 'fixed', customerCents: 20 }, 1],
      ['bad-revision', exact, { kind: 'fixed', customerCents: 20 }, '9007199254740992'],
    ] as const) {
      await database.pool.query(`TRUNCATE app_customer_tariff_cell_versions`);
      await database.pool.query(`INSERT INTO app_customer_tariff_cell_versions
        (tariff_id,selector_key,selector_json,price_json,currency,effective_from,effective_until,revision,updated_by)
        VALUES ($1,$2,$3,$4,'USD','2025-01-01','2025-02-01',$5,$6)`, [id, key(exact), selector, price, revision, actor]);
      assert.deepEqual(await loadCustomerTariffQuoteState(exact), { status: 'unavailable' }, id);
    }
    await database.pool.query('TRUNCATE app_customer_tariff_cell_versions');
    await database.pool.query(`UPDATE app_customer_tariff_cells SET price_json='{}'`);
    assert.deepEqual(await loadCustomerTariffQuoteState(exact), { status: 'unavailable' });
    await database.pool.query('ALTER TABLE app_customer_tariff_state RENAME TO held_state');
    assert.deepEqual(await loadCustomerTariffQuoteState(exact), { status: 'unavailable' });
  });
});

test('all overlapping versions survive and missing, future and expired intervals keep canonical resolution errors', async () => {
  await withTariffReaderFixture(async ({ database }) => {
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE,revision=2');
    const read = async () => {
      const state = await loadCustomerTariffQuoteState(exact);
      assert.equal(state.status, 'loaded');
      if (state.status !== 'loaded') throw new Error('Reader unavailable');
      return state.databaseCells;
    };
    const resolve = (cells: ManualTariffCell[]) => resolveManualTariffCell({ selector: exact,
      at: '2026-10-09T00:00:00.000Z', versionedCells: [], databaseCells: cells });
    assert.throws(() => resolve([]), error => (error as { code?: string }).code === 'missing_cell');
    assert.deepEqual(await read(), []);
    await insertCell(database.pool, makeCell('future', exact, 2, 60, '2099-01-01T00:00:00.000Z'));
    await insertCell(database.pool, makeCell('expired', exact, 1, 50, '2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z'), true);
    assert.throws(() => resolve([makeCell('future', exact, 2, 60, '2099-01-01T00:00:00.000Z')]), error => (error as { code?: string }).code === 'missing_cell');
    const bounded = await read();
    assert.equal(bounded.length, 2, 'SQL must not remove future or expired rows');
    assert.throws(() => resolve(bounded), error => (error as { code?: string }).code === 'missing_cell');
    for (const revision of [2, 1]) await insertCell(database.pool,
      makeCell('overlap', exact, revision, 70, '2026-01-01T00:00:00.000Z', '2099-01-01T00:00:00.000Z'), true);
    const ambiguous = await read();
    assert.deepEqual(ambiguous.map(cell => [cell.id, cell.version]), [['expired', 1], ['overlap', 1], ['overlap', 2], ['future', 2]]);
    assert.throws(() => resolve(ambiguous), error => (error as { code?: string }).code === 'ambiguous_cell');
  });
});

test('default reader remains read-only, rolls back failures and sees a fresh consistent revision after concurrent admin writes', async () => {
  await withTariffReaderFixture(async fixture => {
    const { database, commands } = fixture;
    const initial = makeCell('admin-price');
    await withDbTransaction(executor => upsertCustomerTariffCell(executor, initial, actor), { pool: database.pool });
    await database.pool.query('UPDATE app_customer_tariff_state SET active=TRUE');
    let entered!: () => void, release!: () => void;
    const enteredData = new Promise<void>(resolve => { entered = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    fixture.beforeQuery = async sql => {
      if (!sql.includes('FROM app_customer_tariff_cells')) return;
      entered();
      await held;
    };
    const pending = loadCustomerTariffQuoteState(exact);
    await enteredData;
    try {
      // Finishes while the reader is paused: ordinary quote reads add no write locks.
      await withDbTransaction(async executor => {
        await executor.query("SET LOCAL lock_timeout='500ms'");
        return upsertCustomerTariffCell(executor, { ...initial, price: { kind: 'fixed', customerCents: 65 } }, actor);
      }, { pool: database.pool });
    } finally { release(); fixture.beforeQuery = undefined; }
    const old = await pending;
    assert.deepEqual(old, { status: 'loaded', revision: 1, active: true, versionedCells: [], databaseCells: [initial] });
    assert.equal(commands.length, 4);
    const fresh = await loadCustomerTariffQuoteState(exact);
    assert.equal(fresh.status, 'loaded');
    if (fresh.status === 'loaded') {
      assert.equal(fresh.revision, 2);
      assert.deepEqual(fresh.databaseCells.map(cell => [cell.id, cell.version, cell.price]),
        [['admin-price', 1, initial.price], ['admin-price', 2, { kind: 'fixed', customerCents: 65 }]]);
    }
    fixture.beforeQuery = async (sql, client) => {
      if (!sql.includes('FROM app_customer_tariff_cells')) return;
      fixture.beforeQuery = undefined;
      // Send this deliberate mutation through the same real connection and recorder.
      await client.query('UPDATE app_customer_tariff_state SET revision=999');
    };
    assert.deepEqual(await loadCustomerTariffQuoteState(exact), { status: 'unavailable' });
    assert.equal(commands.at(-1), 'ROLLBACK');
    assert.equal((await database.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '2');
  });
});
