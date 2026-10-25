import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { prepareKlingModifyResolutionTariffs } from '../frontend/server/pricing/kling-modify-resolution-tariffs';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';

const at = '2026-10-22T00:00:00.000Z';
const cells: ManualTariffCell[] = Array.from({ length: 13 }, (_, index) => ({
  id: `old-${index}`, source: 'database', version: 1, currency: 'USD', effectiveFrom: '2026-10-01T00:00:00.000Z',
  selector: { engineId: 'kling-o3-standard', mode: 'v2v', resolution: '1080p', durationSec: String(index + 3) },
  price: { kind: 'fixed', customerCents: Math.ceil((index + 3) * 16.38) },
}));
const state = { status: 'loaded' as const, active: true, revision: 42, versionedCells: [], databaseCells: cells };

test('Kling resolution preparation copies all 13 reviewed amounts without mutating history', async () => {
  const before = structuredClone(state);
  const prepared = prepareKlingModifyResolutionTariffs({ state, at });
  assert.equal(prepared.cells.length, 13);
  assert.equal(prepared.sourceRevision, 42);
  assert.deepEqual(state, before);
  for (const [index, cell] of prepared.cells.entries()) {
    assert.deepEqual(cell.selector, { ...cells[index].selector, resolution: '720p' });
    assert.deepEqual(cell.price, cells[index].price);
    const quote = await computeCanonicalBillingSnapshot({ engine: getFalEngineById('kling-o3-standard')!.engine,
      mode: 'v2v', resolution: '720p', durationSec: index + 3, hasVideoInput: true }, {
      loadCustomerTariffState: async () => ({ ...state, databaseCells: [...cells, ...prepared.cells] }),
      pricingPolicy: { loadOverrides: async () => ({ status: 'loaded', rules: [] }) },
    });
    assert.equal(quote.totalCents, (cell.price as { customerCents: number }).customerCents);
  }
});

test('Kling preparation fails closed on missing, changed or already-authored tariffs', () => {
  assert.throws(() => prepareKlingModifyResolutionTariffs({ state: { ...state, databaseCells: cells.slice(1) }, at }));
  assert.throws(() => prepareKlingModifyResolutionTariffs({ state: { ...state, active: false }, at }));
  const prepared = prepareKlingModifyResolutionTariffs({ state, at });
  assert.throws(() => prepareKlingModifyResolutionTariffs({ state: { ...state, databaseCells: [...cells, ...prepared.cells] }, at }));
  const changed = structuredClone(state);
  changed.databaseCells[0].price = { kind: 'fixed', customerCents: 100 };
  assert.notEqual(prepareKlingModifyResolutionTariffs({ state: changed, at }).fingerprint, prepared.fingerprint);
});
