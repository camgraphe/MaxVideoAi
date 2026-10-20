import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';
import { customerTariffCellId } from '../frontend/server/pricing/customer-tariff-seed';
import { prepareSeedance25LasTariffRelease } from '../frontend/server/pricing-admin/seedance-las-tariff-release';

const at = '2026-10-13T12:00:00.000Z';
function oldState() {
  const cells: ManualTariffCell[] = collectSellableManualTariffCoverage({ modelId: 'seedance-2-5', mode: 'v2v' }).scenarios.map(s => {
    const selector = continuousInputTariffSelector(s.selector)!;
    const id = customerTariffCellId(Object.entries(selector).map(([k,v]) => `${k}=${encodeURIComponent(v)}`).join('|'));
    return { id, selector, source: 'database' as const, version: 1, currency: 'USD', effectiveFrom: '2026-10-02T00:00:00.000Z',
      price: { kind: 'unit_components' as const, rounding: 'up' as const, components: [{ id: 'retail', rounding: 'none' as const,
        flatCents: 62.00000000000001, terms: [{ unit: 'input_video_seconds' as const, centsPerUnit: 8.857077007717129,
          includedUnits: 3.0000520426749935 }] }] } };
  });
  return { status: 'loaded' as const, active: true, revision: 1, versionedCells: [] as ManualTariffCell[], databaseCells: cells };
}

test('LAS review binds all 324 supported source classes and shows the old below-cost saved amount', () => {
  const state = oldState();
  const before = JSON.stringify(state);
  const release = prepareSeedance25LasTariffRelease({ state, at });
  assert.equal(release.cells.length, 324);
  assert.equal(release.sourceRevision, 1);
  assert.equal(release.policy.customerMultiplier, 2.5);
  const row = release.rows.find(r => r.selector.resolution === '480p' && r.selector.durationSec === '4' && r.selector.aspectRatio === '16:9');
  assert.ok(row);
  assert.equal(row.previousSavedCustomerCents, 71);
  assert.equal(row.proposedCustomerCents, 247);
  assert.equal(row.supplierListUsd, 0.984144);
  assert.equal(release.cells.some(c => c.selector.resolution === '1080p'), false);
  assert.equal(JSON.stringify(state), before, 'Preparation must not mutate source prices');
  for (const cell of release.cells) {
    assert.equal(cell.id, state.databaseCells.find(c => JSON.stringify(c.selector) === JSON.stringify(cell.selector))!.id);
  }
});

test('LAS review refuses missing classes, exact overrides, inactive state and stale source changes', () => {
  const state = oldState();
  const initial = prepareSeedance25LasTariffRelease({ state, at });
  state.databaseCells[0].price = { kind: 'fixed', customerCents: 99 };
  assert.notEqual(prepareSeedance25LasTariffRelease({ state, at }).fingerprint, initial.fingerprint);
  const missing = oldState();
  missing.databaseCells = missing.databaseCells.filter(c => !(c.selector.resolution === '480p' && c.selector.durationSec === '4'));
  assert.throws(() => prepareSeedance25LasTariffRelease({ state: missing, at }), /missing|current/i);
  const override = oldState();
  override.databaseCells.push({ ...override.databaseCells[0], id: 'exact-exception', selector: { ...override.databaseCells[0].selector, inputVideoDurationSec: '4' } });
  assert.throws(() => prepareSeedance25LasTariffRelease({ state: override, at }), /exact|exception/i);
  const versioned = oldState();
  versioned.versionedCells.push({ ...versioned.databaseCells[0], id: 'exact-versioned', source: 'versioned',
    selector: { ...versioned.databaseCells[0].selector, inputVideoDurationSec: '4' } });
  assert.throws(() => prepareSeedance25LasTariffRelease({ state: versioned, at }), /exact|exception/i);
  assert.throws(() => prepareSeedance25LasTariffRelease({ state: { ...oldState(), active: false }, at }), /active/i);
});

export { oldState };
