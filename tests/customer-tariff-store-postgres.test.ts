import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { insertPricingChangeEvent, listPricingChangeEvents } from '../frontend/server/pricing-admin/event-store.ts';
import { loadEffectiveCustomerTariffState, loadCustomerTariffQuoteState, upsertCustomerTariffCell } from '../frontend/server/pricing/customer-tariff-store.ts';
import { getDb, withDbTransaction } from '../frontend/src/lib/db.ts';
import { startDisposablePostgres } from './helpers/disposable-postgres.ts';

const actor = '11111111-1111-4111-8111-111111111111';
const cell = {
  id: 'test-tariff', source: 'database' as const, version: 1, currency: 'USD',
  selector: { engineId: 'seedance-2-5', mode: 't2v', resolution: '720p', durationSec: '5' },
  effectiveFrom: '2026-09-29T00:00:00.000Z',
  price: { kind: 'fixed' as const, customerCents: 125 },
};

test('disposable PostgreSQL enforces interval overlap and atomic tariff/event revision', async () => {
  const db = await startDisposablePostgres('customer-tariff');
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  try {
    await db.pool.query(`CREATE TABLE app_pricing_change_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      domain TEXT NOT NULL CHECK (domain IN ('policy_rule', 'membership', 'billing_product')),
      operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'rollback')),
      target_id TEXT NOT NULL, actor_id UUID NOT NULL, previous_state JSONB, next_state JSONB,
      preview_summary JSONB NOT NULL, affected_scenario_ids JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.pool.query(readFileSync('neon/migrations/54_customer_tariff_cells.sql', 'utf8'));
    const initial = await loadEffectiveCustomerTariffState();
    assert.equal(initial.status, 'loaded');
    if (initial.status !== 'loaded') return;
    assert.equal(initial.revision, 0);
    assert.equal(initial.active, false);

    const persisted = await withDbTransaction(async (executor) => {
      const next = await upsertCustomerTariffCell(executor, cell, actor);
      await insertPricingChangeEvent(executor, {
        domain: 'customer_tariff', operation: 'create', targetId: cell.id, actorId: actor,
        previousState: null, nextState: cell, previewSummary: { revision: next.version },
        affectedScenarioIds: ['seedance-t2v-5s-720p'],
      });
      return next;
    });
    assert.equal(persisted.version, 1);
    const loaded = await loadEffectiveCustomerTariffState();
    assert.equal(loaded.status, 'loaded');
    if (loaded.status !== 'loaded') return;
    assert.equal(loaded.revision, 1);
    assert.deepEqual(loaded.databaseCells[0]?.price, cell.price);
    const neighbor = await loadCustomerTariffQuoteState({ ...cell.selector, durationSec: '6' });
    assert.equal(neighbor.status, 'loaded');
    if (neighbor.status === 'loaded') assert.equal(neighbor.databaseCells.length, 0);
    const exact = await loadCustomerTariffQuoteState(cell.selector);
    assert.equal(exact.status, 'loaded');
    if (exact.status === 'loaded') assert.deepEqual(exact.databaseCells.map((row) => row.id), [cell.id]);
    const events = await listPricingChangeEvents({ domain: 'customer_tariff' });
    assert.equal(events.length, 1);
    assert.equal(events[0]?.targetId, cell.id);
    await assert.rejects(db.pool.query(`INSERT INTO app_customer_tariff_cells
      (id, selector_key, selector_json, price_json, currency, effective_from, revision, updated_by)
      SELECT 'overlap', selector_key, selector_json, price_json, currency, effective_from, 2, updated_by
      FROM app_customer_tariff_cells WHERE id = 'test-tariff'`), /overlapping customer tariff intervals/);
    await assert.rejects(withDbTransaction(async (executor) => {
      await upsertCustomerTariffCell(executor, { ...cell, id: 'rolled-back',
        selector: { ...cell.selector, durationSec: '6' } }, actor);
      throw new Error('rollback');
    }), /rollback/);
    const afterRollback = await loadEffectiveCustomerTariffState();
    assert.equal(afterRollback.status, 'loaded');
    if (afterRollback.status === 'loaded') assert.equal(afterRollback.revision, 1);
  } finally {
    await getDb().end().catch(() => undefined);
    await db.cleanup();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  }
});
