import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolveManualTariffCell } from '@maxvideoai/pricing';
import { getDb, withDbTransaction } from '../frontend/src/lib/db.ts';
import { loadEffectiveCustomerTariffState, upsertCustomerTariffCell,
  deleteStagedCustomerTariffCell } from '../frontend/server/pricing/customer-tariff-store.ts';
import { startDisposablePostgres } from './helpers/disposable-postgres.ts';

test('active tariff edits append effective versions and preserve earlier quote resolution', async () => {
  const db = await startDisposablePostgres('temporal-tariff');
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await db.pool.query(`CREATE TABLE app_pricing_change_events (domain TEXT CHECK (domain IN ('policy_rule')))`);
    await db.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql', 'utf8'));
    // The new migration must be safe for existing staged rows as well as fresh databases.
    const actor = '11111111-1111-4111-8111-111111111111';
    const initial = { id: 'logical-price', source: 'database' as const, version: 1, currency: 'USD',
      selector: { engineId: 'pika-text-to-video', mode: 't2v', durationSec: '5', resolution: '720p' },
      effectiveFrom: '2026-09-29T00:00:00.000Z', price: { kind: 'fixed' as const, customerCents: 26 } };
    await withDbTransaction((executor) => upsertCustomerTariffCell(executor, initial, actor));
    const migration = 'neon/migrations/55_customer_tariff_versions.sql';
    assert.ok(readFileSync(migration, 'utf8').includes('tariff_id'));
    await db.pool.query(readFileSync(migration, 'utf8'));
    await db.pool.query('UPDATE app_customer_tariff_state SET active = TRUE');
    const updated = await withDbTransaction((executor) => upsertCustomerTariffCell(executor,
      { ...initial, price: { kind: 'fixed', customerCents: 31 } }, actor));
    assert.equal(updated.id, initial.id);
    assert.equal(updated.version, 2);
    assert.ok(Date.parse(updated.effectiveFrom) > Date.parse(initial.effectiveFrom));
    const state = await loadEffectiveCustomerTariffState();
    assert.equal(state.status, 'loaded');
    if (state.status !== 'loaded') return;
    assert.equal(state.databaseCells.length, 2);
    const old = resolveManualTariffCell({ selector: initial.selector, at: initial.effectiveFrom,
      versionedCells: [], databaseCells: state.databaseCells });
    const next = resolveManualTariffCell({ selector: initial.selector, at: updated.effectiveFrom,
      versionedCells: [], databaseCells: state.databaseCells });
    assert.deepEqual(old.price, { kind: 'fixed', customerCents: 26 });
    assert.deepEqual(next.price, { kind: 'fixed', customerCents: 31 });
    assert.equal(old.effectiveUntil, updated.effectiveFrom);
    await assert.rejects(withDbTransaction((executor) => deleteStagedCustomerTariffCell(executor, initial.id)), /cannot be deleted/i);
    await assert.rejects(withDbTransaction((executor) => upsertCustomerTariffCell(executor,
      { ...initial, selector: { ...initial.selector, resolution: '1080p' } }, actor)), /selector/i);
    assert.equal((await db.pool.query('SELECT revision FROM app_customer_tariff_state')).rows[0].revision, '2');
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous;
  }
});
