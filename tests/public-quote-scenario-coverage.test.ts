import assert from 'node:assert/strict';
import test from 'node:test';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';

test('scoped public coverage preserves every full-audit scenario and gap for each requested model and mode', () => {
  const full = collectSellableManualTariffCoverage();
  for (const model of listRuntimeModels().filter(model => model.publication.app.published)) {
    const expected = {
      scenarios: full.scenarios.filter(scenario => scenario.modelId === model.id),
      gaps: full.gaps.filter(gap => gap.modelId === model.id),
    };
    const scoped = collectSellableManualTariffCoverage({ modelId: model.id });
    assert.equal(scoped.scenarios.length, expected.scenarios.length, model.id);
    assert.deepEqual(scoped, expected, model.id);
    for (const mode of getFalEngineById(model.id)!.modes) {
      assert.deepEqual(collectSellableManualTariffCoverage({ modelId: model.id, mode: mode.mode }), {
        scenarios: expected.scenarios.filter(scenario => scenario.context.mode === mode.mode),
        gaps: expected.gaps.filter(gap => gap.reason.startsWith(`${mode.mode}:`)),
      }, `${model.id}/${mode.mode}`);
    }
  }
});

test('unknown or unpublished model and unsupported mode scopes cannot expand to the whole catalogue', () => {
  for (const scope of [
    { modelId: 'missing-model' },
    { modelId: '' },
    { modelId: 'wan-3', mode: 'missing-mode' },
    { modelId: 'wan-3', mode: '' },
    ...listRuntimeModels().filter(model => !model.publication.app.published).map(model => ({ modelId: model.id })),
  ]) {
    const scoped = collectSellableManualTariffCoverage(scope);
    assert.equal(scoped.scenarios.length, 0, JSON.stringify(scope));
    assert.deepEqual(scoped, { scenarios: [], gaps: [] });
  }
});
