import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { prepareSeedanceWorkflowTariffSeed } from '../frontend/server/pricing/seedance-workflow-tariffs';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';

test('workflow preparation copies current cents once into independent cells and binds its review to the source revision', async () => {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const scenarios = ['480p', '1080p'].map(resolution => buildManualTariffCoverageScenario({
    engine: { ...engine, providerMeta: { ...engine.providerMeta, provider: 'byteplus_modelark' } },
    mode: 't2v', durationSec: 5, resolution, aspectRatio: '16:9', hasVideoInput: false,
  }, 'normal'));
  const policy = { status: 'loaded' as const, rules: [] };
  const state = { status: 'loaded' as const, revision: 4, active: true, versionedCells: [],
    databaseCells: scenarios.map((s, i) => ({ id: `normal-${i}`, selector: s.selector,
      source: 'database' as const, version: 1, currency: 'USD', effectiveFrom: '2026-09-28T00:00:00Z',
      price: { kind: 'fixed' as const, customerCents: i === 0 ? 129 : 651 } })) };
  const prepared = await prepareSeedanceWorkflowTariffSeed({ normalScenarios: scenarios, state, policy });
  assert.equal(prepared.cells.length, 2);
  assert.deepEqual(prepared.cells.map(c => c.price), [{ kind: 'fixed', customerCents: 129 }, { kind: 'fixed', customerCents: 651 }]);
  assert.deepEqual(prepared.cells.map(c => c.selector.workflowStep), ['draft', 'final']);
  assert.equal(prepared.sourceRevision, 4);
  assert.ok(prepared.fingerprint);
  const changed = await prepareSeedanceWorkflowTariffSeed({ normalScenarios: scenarios, state: { ...state, revision: 5 }, policy });
  assert.notEqual(changed.fingerprint, prepared.fingerprint);
  assert.equal((await prepareSeedanceWorkflowTariffSeed({ normalScenarios: scenarios, state, policy })).fingerprint, prepared.fingerprint);
  for (const [index, step] of ['draft', 'final'].entries()) {
    const quote = await computeCanonicalBillingSnapshot({ ...scenarios[index].context, workflowStep: step as 'draft' | 'final' }, {
      pricingPolicy: { loadOverrides: async () => policy },
      loadCustomerTariffState: async () => ({ ...state, databaseCells: prepared.cells }),
    });
    assert.equal(quote.totalCents, index === 0 ? 129 : 651);
  }
  await assert.rejects(prepareSeedanceWorkflowTariffSeed({ normalScenarios: scenarios, state: { ...state, active: false }, policy }), /active/i);
});
