import assert from 'node:assert/strict';
import test from 'node:test';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { isKlingV4ReleaseBlocked, assertKlingV4ReleaseReady } from '../frontend/src/server/video-generation/kling-v4-release-policy';
import { resolveAgentGenerationModeExecutability } from '../frontend/src/server/agent-runtime/model-executability';
import { listAgentModels } from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { klingV4TariffScenarios } from '../frontend/lib/pricing-audit/kling-v4-tariff-scenario';
import { chooseCustomerTariffScenario } from '../frontend/server/pricing-admin/customer-tariff-service';
import { prepareContinuousInputTariffChange } from '../frontend/server/pricing-admin/continuous-input-tariff';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import type { ManualTariffCell } from '@maxvideoai/pricing';

test('functional publication exposes four qualified modes independently of marketing and supports closed rollback', async () => {
  const model = getRuntimeModelById('kling-v4')!;
  assert.equal(model.publication.app.published, true);
  assert.equal(isKlingV4ReleaseBlocked('kling-v4'), false);
  const original = {
    appPublished: model.publication.app.published,
    modelIndexable: model.publication.model.indexable,
    examplesPublished: model.publication.examples.published,
  };
  try {
    // Functional access remains available when both marketing gates are closed.
    model.publication.model.indexable = false;
    model.publication.examples.published = false;
    assert.equal(isKlingV4ReleaseBlocked('kling-v4'), false);
    assert.doesNotThrow(() => assertKlingV4ReleaseReady('kling-v4'));
    const engine = getFalEngineById('kling-v4')!.engine;
    assert.equal(engine.status, 'live');
    assert.equal(engine.availability, 'available');
    const deps = { listEngines: async () => [engine], surfaceByEngineId: () => 'video' as const,
      isModeExecutable: (selected: typeof engine, mode: Parameters<typeof resolveAgentGenerationModeExecutability>[1]) =>
        resolveAgentGenerationModeExecutability(selected, mode,
          { bytePlusEnabled: false, bytePlusApiKey: undefined, falApiKey: 'offline-only' }).executable };
    assert.equal((await listAgentModels({}, deps)).some(entry => entry.id === 'kling-v4'), true);
    const details = await getAgentModelDetails('kling-v4', deps);
    assert.equal(details.generationEnabled, true);
    assert.equal(details.prelaunch, false);
    assert.deepEqual(details.modes.map(mode => mode.mode).sort(), ['i2v', 'ref2v', 't2v', 'v2v']);
    assert.equal(details.modes.find(mode => mode.mode === 'ref2v')?.subjects?.voiceBinding, 'unavailable');
    assert.ok(details.modes.find(mode => mode.mode === 'i2v')?.references.length);
    for (const mode of ['t2v', 'i2v', 'ref2v', 'v2v'] as const) {
      assert.deepEqual(resolveAgentGenerationModeExecutability(engine, mode,
        { bytePlusEnabled: false, bytePlusApiKey: undefined, falApiKey: 'offline-only' }),
      { executable: true, reason: 'available' });
    }
    // Availability must not create an unreviewed or legacy customer price.
    const scenarios = klingV4TariffScenarios();
    const state = { status: 'loaded' as const, active: true, revision: 7, versionedCells: [], databaseCells: [] as ManualTariffCell[] };
    const policy = { status: 'loaded' as const, rules: [] };
    for (const [mode, resolution, durationSec, source, expected, rate] of [
      ['t2v', '720p', '5', null, 118, null], ['t2v', '720p', '10', null, 236, null],
      ['t2v', '1080p', '5', null, 177, null], ['ref2v', '720p', '5', '10.2501', 216, 14.1],
      ['v2v', '1080p', '5', '10.2501', 323, 21.15],
    ] as const) {
      const { scenario } = chooseCustomerTariffScenario(scenarios, { mode, resolution, durationSec,
        billingInputType: source ? 'video_input' : 'no_video_input', ...(source ? { inputVideoDurationSec: source } : {}) });
      const context = { ...scenario.context, engine };
      await assert.rejects(computeCanonicalBillingSnapshot(context, {
        pricingPolicy: { loadOverrides: async () => policy }, loadCustomerTariffState: async () => state,
      }));
      const cell: ManualTariffCell = rate ? (await prepareContinuousInputTariffChange({ scenario, state, policy,
        proposal: { operation: 'create', scenarioId: scenario.id, scope: 'continuous_input',
          price: { kind: 'kling_v4_billable', customerCentsPerBillableSecond: rate } } })).proposedCell!
        : { id: `offline-only-${mode}-${resolution}-${durationSec}`, selector: scenario.selector,
          currency: 'USD', source: 'database', version: 8, effectiveFrom: '2026-10-26T00:00:00Z',
          price: { kind: 'fixed', customerCents: expected } };
      const quote = await computeCanonicalBillingSnapshot(context, { pricingPolicy: { loadOverrides: async () => policy },
        loadCustomerTariffState: async () => ({ ...state, databaseCells: [cell] }) });
      assert.equal(quote.totalCents, expected);
      assert.equal(quote.meta?.customerTariffRevision, 7);
    }
    assert.deepEqual(state.databaseCells, [], 'local quote preparation never persists cells');
    // Published marketing cannot reopen an explicitly closed generation gate.
    model.publication.model.indexable = true;
    model.publication.examples.published = true;
    model.publication.app.published = false;
    assert.deepEqual(await listAgentModels({}, deps), []);
    assert.equal(isKlingV4ReleaseBlocked('kling-v4'), true);
    assert.throws(() => assertKlingV4ReleaseReady('kling-v4'), /KLING_V4_NOT_QUALIFIED/);
    assert.equal(isKlingV4ReleaseBlocked('kling-3-pro'), false);
    assert.equal(isKlingV4ReleaseBlocked(undefined), false);
  } finally {
    model.publication.app.published = original.appPublished;
    model.publication.model.indexable = original.modelIndexable;
    model.publication.examples.published = original.examplesPublished;
  }
  assert.equal(isKlingV4ReleaseBlocked('kling-v4'), false);
});
