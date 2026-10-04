import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadEffectiveCustomerTariffState,
  validateCustomerTariffCell,
} from '../frontend/server/pricing/customer-tariff-store.ts';

const base = {
  id: 'seedance-test', source: 'database' as const, version: 1, currency: 'USD',
  selector: { engineId: 'seedance-2-5', mode: 't2v', resolution: '720p', durationSec: '5' },
  effectiveFrom: '2026-09-29T00:00:00.000Z',
  price: { kind: 'fixed' as const, customerCents: 125 },
};

test('inactive store loads versioned and database cells with one revision', async () => {
  const calls: string[] = [];
  const state = await loadEffectiveCustomerTariffState({
    async query<T>(sql: string): Promise<T[]> {
      calls.push(sql);
      if (sql.includes('FROM app_customer_tariff_state')) return [{ revision: '7', active: false }] as T[];
      if (sql.includes('FROM app_customer_tariff_cells')) return [{
        id: base.id, selector_json: base.selector, price_json: base.price, currency: 'USD',
        effective_from: base.effectiveFrom, effective_until: null, revision: '7',
      }] as T[];
      throw new Error(`Unexpected query: ${sql}`);
    },
  });
  assert.equal(state.status, 'loaded');
  if (state.status !== 'loaded') return;
  assert.equal(state.active, false);
  assert.equal(state.revision, 7);
  assert.equal(state.databaseCells.length, 1);
  assert.deepEqual(state.databaseCells[0]?.selector, base.selector);
  assert.equal(state.versionedCells.length, 0);
  assert.equal(calls.length, 2);
});

test('database outage never masquerades as the empty inactive store', async () => {
  const state = await loadEffectiveCustomerTariffState({ async query() { throw new Error('database down'); } });
  assert.deepEqual(state, { status: 'unavailable' });
});

test('cells need exact nonempty selectors, safe cents and valid effective intervals', () => {
  assert.deepEqual(validateCustomerTariffCell(base), base);
  assert.throws(() => validateCustomerTariffCell({ ...base, selector: { engineId: 'seedance-2-5', mode: '' } }));
  assert.throws(() => validateCustomerTariffCell({ ...base, effectiveUntil: base.effectiveFrom }));
  assert.throws(() => validateCustomerTariffCell({ ...base, price: { kind: 'fixed', customerCents: 1.5 } }));
  assert.throws(() => validateCustomerTariffCell({ ...base, source: 'versioned' }));
});
