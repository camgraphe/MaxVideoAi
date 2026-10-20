import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { prepareSeedanceMultimodalWorkflowTariffs } from '../frontend/server/pricing/seedance-multimodal-workflow-tariffs';
import { continuousInputTariffSelector } from '../frontend/src/lib/pricing-manual-scenario';

test('new workflow variants freeze their exact normal price curves and preserve existing independent stages', async () => {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const scenario = buildManualTariffCoverageScenario({ engine, mode: 'ref2v', resolution: '480p', durationSec: 4,
    aspectRatio: '16:9', hasVideoInput: true, inputVideoDurationSec: 2 }, 'fixture');
  const selector = continuousInputTariffSelector(scenario.selector)!;
  const price = { kind: 'unit_components' as const, rounding: 'up' as const, components: [{ id: 'retail', rounding: 'none' as const,
    flatCents: 5000, terms: [{ unit: 'input_video_seconds', centsPerUnit: 100, includedUnits: 3 }] }] };
  const normal = { id: 'normal-curve', source: 'versioned' as const, version: 1, currency: 'USD', selector,
    effectiveFrom: '2026-01-01T00:00:00Z', price };
  const state = { status: 'loaded' as const, active: true, revision: 3, versionedCells: [normal], databaseCells: [] };
  const input = { state, normalScenarios: [scenario], actorId: '11111111-1111-4111-8111-111111111111', candidateCommit: 'a'.repeat(40), at: '2026-10-13T12:00:00Z' };
  const before = structuredClone(state);
  const prepared = await prepareSeedanceMultimodalWorkflowTariffs(input);
  assert.equal(prepared.cells.length, 1);
  assert.deepEqual(prepared.cells[0].price, price);
  assert.deepEqual(prepared.cells[0].selector, { ...selector, workflowStep: 'draft' });
  assert.deepEqual(state, before);
  assert.equal((await prepareSeedanceMultimodalWorkflowTariffs(input)).fingerprint, prepared.fingerprint);
  const changed = structuredClone(state); changed.versionedCells[0].price.components[0].flatCents += 1;
  assert.notEqual((await prepareSeedanceMultimodalWorkflowTariffs({ ...input, state: changed })).fingerprint, prepared.fingerprint);
  const stage = { ...normal, id: 'independent-draft', selector: { ...selector, workflowStep: 'draft' },
    price: { kind: 'unit_components' as const, rounding: 'up' as const, components: [{ ...price.components[0], flatCents: 6000 }] } };
  const existing = await prepareSeedanceMultimodalWorkflowTariffs({ ...input, state: { ...state, versionedCells: [...state.versionedCells, stage] } });
  assert.equal(existing.cells.length, 0);
  assert.equal(existing.preservedStageCells, 1);
});
