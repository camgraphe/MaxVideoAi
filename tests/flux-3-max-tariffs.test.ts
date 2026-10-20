import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildManualTariffCoverageScenario } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { prepareFlux3MaxTariffs, applyFlux3MaxTariffs } from '../frontend/server/pricing/flux-3-max-tariffs';
import { assertFlux3MaxReleaseReview } from '../frontend/scripts/_lib/flux-3-max-release-input';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';

const identity = { actorId: '11111111-1111-4111-8111-111111111111', candidateCommit: 'a'.repeat(40) };
const state = { status: 'loaded' as const, active: true, revision: 3, versionedCells: [], databaseCells: [] };
function coverage() {
  const engine = getFalEngineById('flux-3-max')!.engine;
  return { gaps: [], scenarios: (['t2v', 'i2v', 'fl2v', 'ref2v'] as const).flatMap(mode =>
    ['720p', '1080p'].flatMap(resolution => Array.from({ length: 16 }, (_, i) =>
      buildManualTariffCoverageScenario({ engine, mode, resolution, durationSec: i + 5,
        aspectRatio: '16:9', addons: { audio: true } }, 'fixture')))) };
}
const input = () => ({ ...identity, state, coverage: coverage(), at: '2026-10-20T00:00:00Z' });

test('published FLUX 3 Max catalog supplies all 128 canonical tariff selectors without a manual fixture', async () => {
  const prepared = await prepareFlux3MaxTariffs({ ...identity, state });
  assert.equal(prepared.cells.length, 128);
  assert.deepEqual([...new Set(prepared.cells.map(cell => cell.selector.mode))].sort(), ['fl2v', 'i2v', 'ref2v', 't2v']);
});

test('FLUX 3 Max freezes normal list plus 30 percent for every mode, resolution and whole duration', async () => {
  const before = structuredClone(state);
  const prepared = await prepareFlux3MaxTariffs(input());
  assert.equal(prepared.cells.length, 128);
  assert.equal(new Set(prepared.cells.map(cell => JSON.stringify(cell.selector))).size, 128);
  for (const mode of ['t2v', 'i2v', 'fl2v', 'ref2v']) {
    for (const [resolution, seconds, cents] of [['720p', '5', 111], ['720p', '10', 221], ['720p', '20', 442],
      ['1080p', '5', 189], ['1080p', '10', 377], ['1080p', '20', 754]] as const) {
      const cell = prepared.cells.find(row => row.selector.mode === mode && row.selector.resolution === resolution && row.selector.durationSec === seconds);
      assert.deepEqual(cell?.price, { kind: 'fixed', customerCents: cents });
      assert.equal(cell?.currency, 'USD');
    }
  }
  assert.deepEqual(state, before);
  assert.equal((await prepareFlux3MaxTariffs({ ...input(), at: '2026-10-19T00:00:00Z' })).fingerprint, prepared.fingerprint);
  assert.notEqual((await prepareFlux3MaxTariffs({ ...input(), state: { ...state, revision: 4 } })).fingerprint, prepared.fingerprint);
});

test('tariff initialization rejects incomplete coverage, inactive state and existing model tariffs without overwriting', async () => {
  const prepared = await prepareFlux3MaxTariffs(input());
  await assert.rejects(prepareFlux3MaxTariffs({ ...input(), state: { ...state, active: false } }), /active/i);
  await assert.rejects(prepareFlux3MaxTariffs({ ...input(), state: { ...state, databaseCells: [prepared.cells[0]!] } }), /existing/i);
  const missing = coverage(); missing.scenarios.pop();
  await assert.rejects(prepareFlux3MaxTariffs({ ...input(), coverage: missing }), /coverage/i);
  await assert.rejects(prepareFlux3MaxTariffs({ ...input(), coverage: { ...coverage(), gaps: [{ modelId: 'flux-3-max', reason: 'unbounded' }] } }), /coverage/i);
  const changed = coverage(); changed.scenarios[0] = { ...changed.scenarios[0]!, selector: { ...changed.scenarios[0]!.selector, audio: 'true' } };
  await assert.rejects(prepareFlux3MaxTariffs({ ...input(), coverage: changed }), /coverage|selector/i);
  const discounted = coverage();
  const first = discounted.scenarios[0]!;
  discounted.scenarios[0] = { ...first, context: { ...first.context, engine: { ...first.context.engine,
    pricingDetails: { ...first.context.engine.pricingDetails, perSecondCents: { default: 4.25, byResolution: { '720p': 4.25, '1080p': 7.25 } } },
  } } };
  await assert.rejects(prepareFlux3MaxTariffs({ ...input(), coverage: discounted }), /normal.*list rate changed/i);
});

test('review receipts bind actor, exact candidate, database, policy, revision and complete model scope', async () => {
  const prepared = await prepareFlux3MaxTariffs(input());
  const release = { ...identity, databaseIdentity: 'reviewed-target' };
  const receipt = { ...release, policy: prepared.policy, fingerprint: prepared.fingerprint, sourceRevision: 3,
    insertedCells: 128, scope: prepared.scope, existingPricesChanged: false };
  assert.doesNotThrow(() => assertFlux3MaxReleaseReview(receipt, release));
  for (const patch of [{ candidateCommit: 'b'.repeat(40) }, { databaseIdentity: 'other' }, { actorId: 'other' },
    { policy: 'promo' }, { fingerprint: '' }, { insertedCells: 96 }, { sourceRevision: -1 },
    { scope: { ...prepared.scope, modes: ['t2v'] } }, { existingPricesChanged: true }]) {
    assert.throws(() => assertFlux3MaxReleaseReview({ ...receipt, ...patch }, release), /review/i);
  }
});

test('apply refuses a non-transaction executor before it can issue any database query', async () => {
  let calls = 0;
  const executor = { query: async () => { calls++; return []; } } as unknown as TransactionQueryExecutor;
  await assert.rejects(applyFlux3MaxTariffs(executor, { ...identity, authorizedActorId: identity.actorId,
    authorizedCandidateCommit: identity.candidateCommit, policy: 'flux_3_max_normal_list_plus_30_percent_v1',
    fingerprint: 'a'.repeat(64), sourceRevision: 3 }), /authorized|transaction/i);
  assert.equal(calls, 0);
});
