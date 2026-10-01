import assert from 'node:assert/strict';
import test from 'node:test';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { evaluateManualTariffPrice } from '../packages/pricing/src/manual-tariff-price';
import type { ManualTariffCell } from '../packages/pricing/src/manual-tariff';
import { prepareSeedanceInputTariffSeed } from '../frontend/server/pricing/seedance-input-tariff-seed';
import { ENV } from '../frontend/src/lib/env';

test('seed freezes existing positive margins, repairs negative minima, and binds the exact reviewed state', async () => {
  const oldProvider = ENV.SEEDANCE_2_PROVIDER;
  ENV.SEEDANCE_2_PROVIDER = 'byteplus_modelark';
  try {
    const scenarios = collectSellableManualTariffCoverage().scenarios.filter(s =>
      ['seedance-2-0','seedance-2-5'].includes(s.modelId) && s.selector.mode === 'ref2v'
      && s.selector.durationSec === '4' && s.selector.resolution === '480p'
      && s.selector.aspectRatio === (s.modelId === 'seedance-2-5' ? '1:1' : '16:9')
      && s.selector.billingInputType === 'video_input');
    // Limit to one exact options variant of each model.
    const selected = ['seedance-2-0','seedance-2-5'].map(id => scenarios.find(s => s.modelId === id)!).filter(Boolean);
    assert.equal(selected.length,2);
    const cells: ManualTariffCell[] = selected.flatMap(s => {
      const { inputVideoDurationSec: _, ...selector } = s.selector;
      const cents = s.modelId === 'seedance-2-5' ? 35 : 68;
      return [{ id: `${s.modelId}-video`, source: 'database' as const, version: 1, selector, currency: 'USD',
        effectiveFrom: '2026-10-01T00:00:00Z', price: { kind: 'fixed' as const, customerCents: cents } },
      { id: `${s.modelId}-no-video`, source: 'database' as const, version: 1,
        selector: { ...selector, billingInputType: 'no_video_input' }, currency: 'USD',
        effectiveFrom: '2026-10-01T00:00:00Z', price: { kind: 'fixed' as const, customerCents: s.modelId === 'seedance-2-5' ? 58 : 68 } }];
    });
    const state = { status: 'loaded' as const, active: true, revision: 328, databaseCells: cells, versionedCells: [] };
    const prepared = await prepareSeedanceInputTariffSeed({ scenarios: selected, state, at: '2026-10-01T12:00:00Z' });
    assert.equal(prepared.cells.length,2);
    assert.equal(prepared.correctedMinimumCount,1);
    const standard = prepared.cells.find(c => c.selector.engineId === 'seedance-2-0')!;
    assert.equal(evaluateManualTariffPrice(standard.price,{ input_video_seconds: 15 }).customerTotalCents,185);
    const mini = prepared.cells.find(c => c.selector.engineId === 'seedance-2-5')!;
    assert.equal(evaluateManualTariffPrice(mini.price,{ input_video_seconds: 30 }).customerTotalCents,297);
    const same = await prepareSeedanceInputTariffSeed({ scenarios: selected, state, at: '2026-10-01T12:01:00Z' });
    assert.equal(same.fingerprint,prepared.fingerprint);
    const changed = await prepareSeedanceInputTariffSeed({ scenarios: selected, state: { ...state, revision: 329 }, at: '2026-10-01T12:00:00Z' });
    assert.notEqual(changed.fingerprint,prepared.fingerprint);
    assert.equal(cells[0].price.kind,'fixed');
  } finally { ENV.SEEDANCE_2_PROVIDER = oldProvider; }
});
