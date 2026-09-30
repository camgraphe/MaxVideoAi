import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { continuousWanTariffIdentity, prepareContinuousWanTariffChange } from '../frontend/server/pricing-admin/continuous-wan-tariff';

test('preserve current copies live rounding while inactive, and the current authored price after activation', async () => {
  const scenario = buildManualTariffCoverageScenario({ engine: getFalEngineById('wan-3')!.engine, mode: 'v2v', durationSec: 5,
    resolution: '720p', aspectRatio: '16:9', inputVideoDurationSec: 3.25 }, 'fixture');
  const { id, selector } = continuousWanTariffIdentity(scenario);
  const price = { kind: 'unit_components' as const, rounding: 'nearest' as const, components: [
    { id: 'retail', flatCents: 80, rounding: 'none' as const, terms: [{ unit: 'input_video_seconds', centsPerUnit: 15 }] },
  ] };
  const state = { status: 'loaded' as const, active: false, revision: 2, versionedCells: [], databaseCells: [
    { id, selector, source: 'database' as const, version: 2, price, currency: 'USD', effectiveFrom: '2026-09-29T00:00:00Z' },
  ] };
  const input = { scenario, state, proposal: { operation: 'update' as const, scope: 'continuous_input' as const,
    scenarioId: scenario.id, price: { kind: 'preserve_current' as const } },
    policy: { status: 'loaded' as const, rules: [{ id: 'default', marginPercent: 0.3, marginFlatCents: 0,
      surchargeAudioPercent: 0.2, surchargeUpscalePercent: 0.5, currency: 'USD' }] } };
  assert.equal((await prepareContinuousWanTariffChange(input)).proposedCents, 108, 'a prepared draft is not the live price');
  assert.equal((await prepareContinuousWanTariffChange({ ...input, state: { ...state, active: true } })).proposedCents, 129,
    'after activation do not resurrect the retired percentage rule');
});
