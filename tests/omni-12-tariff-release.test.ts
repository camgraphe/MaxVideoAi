import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffPrice } from '@maxvideoai/pricing';
import { evaluateManualTariffPrice } from '@maxvideoai/pricing/src/manual-tariff-price';
import { collectSellableManualTariffCoverage } from '../frontend/lib/pricing-audit/manual-tariff-coverage';
import { computeCanonicalBillingSnapshot } from '../frontend/server/pricing/quote-billing';
import { computeCanonicalPublicSnapshot } from '../frontend/server/pricing/quote-public';
import { prepareOmni12TariffRelease, scaleOmni11CustomerPrice, applyOmni12TariffRelease } from '../frontend/server/pricing/omni-12-tariff-release';
import { assertOmni12ReleaseReview } from '../frontend/scripts/_lib/omni-12-release-input';
import { adjacentNonnegativeDouble } from '../frontend/server/pricing/pricing-number-boundaries';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { omniPreviousTariffState, omniReleaseIdentity } from './helpers/omni-12-tariff-fixture';

test('1.2 scales saved customer cents, rounding once, without changing the token coordinate or source', () => {
  for (const [before, after] of [[0, 0], [23, 35], [67, 101], [99, 149], [132, 198], [198, 297]]) {
    assert.deepEqual(scaleOmni11CustomerPrice({ kind: 'fixed', customerCents: before }), { kind: 'fixed', customerCents: after });
  }
  const old: ManualTariffPrice = { kind: 'unit_bands', divisor: 10000, maxUnits: 110.048,
    terms: [{ unit: 'output_tokens', centsPerUnit: 17.5 }, { unit: 'input_tokens', centsPerUnit: 1.5 }],
    bands: [{ minUnits: 0, customerCents: 23 }, { minUnits: 30, customerCents: 67 }, { minUnits: 70, customerCents: 132 }] };
  const unchanged = structuredClone(old);
  const next = scaleOmni11CustomerPrice(old);
  assert.deepEqual(next, { ...old, bands: [{ minUnits: 0, customerCents: 35 }, { minUnits: 30, customerCents: 101 }, { minUnits: 70, customerCents: 198 }] });
  for (const boundary of [0, 30, 70, 110.048]) for (const cost of boundary ? [adjacentNonnegativeDouble(boundary, 'previous'), boundary] : [0]) {
    const quantities = { output_tokens: 0, input_tokens: cost * 10000 / 1.5 };
    assert.equal(evaluateManualTariffPrice(next, quantities).customerTotalCents,
      Math.ceil(evaluateManualTariffPrice(old, quantities).customerTotalCents * 1.5));
  }
  assert.deepEqual(old, unchanged);
  assert.throws(() => scaleOmni11CustomerPrice({ kind: 'unit_terms', rounding: 'up', terms: [{ unit: 'output_seconds', centsPerUnit: 5 }] }), /review|unsupported/i);
  assert.throws(() => scaleOmni11CustomerPrice({ kind: 'fixed', customerCents: Number.MAX_SAFE_INTEGER }), /safe|range/i);
});

test('the complete 456-class release retains all options and agrees across billing and public quotes', async () => {
  const state = omniPreviousTariffState(), before = structuredClone(state);
  const release = await prepareOmni12TariffRelease({ state, ...omniReleaseIdentity });
  assert.equal(release.cells.length, 456);
  assert.equal(release.cells.filter(c => c.price.kind === 'fixed').length, 416);
  assert.equal(release.cells.filter(c => c.price.kind === 'unit_bands').length, 40);
  const afterState = { ...state, databaseCells: release.cells };
  const policy = { loadOverrides: async () => ({ status: 'loaded' as const, rules: [], routingRules: [] }) };
  const scenarios = collectSellableManualTariffCoverage({ modelId: 'gemini-omni-flash' }).scenarios;
  const contexts = scenarios.map(s => s.context);
  for (const mode of ['v2v', 'extend', 'retake'] as const) for (const resolution of ['360p', '720p', '1080p', '4k']) {
    const source = contexts.find(c => c.mode === mode && c.resolution === resolution)!;
    contexts.push({ ...source, inputVideoDurationSec: mode === 'retake' ? 0 : 3.25,
      inheritedDurationSec: mode === 'extend' ? undefined : 3.25 });
  }
  for (const context of contexts) {
    const previous = await computeCanonicalBillingSnapshot(context, { loadCustomerTariffState: async () => state, pricingPolicy: policy });
    const options = { loadCustomerTariffState: async () => afterState, pricingPolicy: policy };
    const billing = await computeCanonicalBillingSnapshot(context, options);
    const visible = await computeCanonicalPublicSnapshot(context, options);
    assert.equal(billing.totalCents, Math.ceil(previous.totalCents * 1.5), `${context.mode}/${context.resolution}/${context.durationSec}`);
    assert.equal(visible.totalCents, billing.totalCents);
    assert.equal(billing.meta?.customerTariffCellId, previous.meta?.customerTariffCellId);
  }
  assert.deepEqual(state, before);
  assert.equal(release.rows.length, 544);
});

test('release refuses incomplete, changed or ambiguous grids and binds the exact source revision', async () => {
  const state = omniPreviousTariffState();
  const prepare = (s = state) => prepareOmni12TariffRelease({ state: s, ...omniReleaseIdentity });
  const release = await prepare();
  await assert.rejects(prepare({ ...state, active: false }), /active/i);
  await assert.rejects(prepare({ ...state, databaseCells: state.databaseCells.slice(1) }), /complete|missing|coverage/i);
  await assert.rejects(prepare({ ...state, databaseCells: [...state.databaseCells, { ...state.databaseCells[0], id: 'duplicate' }] }), /duplicate|ambiguous|coverage/i);
  await assert.rejects(prepare({ ...state, versionedCells: [{ ...state.databaseCells[0], source: 'versioned' }] }), /versioned|review/i);
  await assert.rejects(prepare({ ...state, databaseCells: state.databaseCells.map((c, i) => i ? c : { ...c, currency: 'EUR' }) }), /USD|currency/i);
  await assert.rejects(prepare({ ...state, databaseCells: state.databaseCells.map((c, i) => i ? c : { ...c, effectiveFrom: '2099-01-01T00:00:00Z' }) }), /future|current|unavailable/i);
  assert.notEqual((await prepare({ ...state, revision: 501 })).fingerprint, release.fingerprint);
  assert.notEqual((await prepareOmni12TariffRelease({ state, ...omniReleaseIdentity, candidateCommit: 'b'.repeat(40) })).fingerprint, release.fingerprint);
  const modified = structuredClone(state);
  const fixed = modified.databaseCells.find(c => c.price.kind === 'fixed')!;
  fixed.price = { kind: 'fixed', customerCents: 3000 };
  assert.notEqual((await prepare(modified)).fingerprint, release.fingerprint);
  const newBasis = structuredClone(state);
  const bandCell = newBasis.databaseCells.find(c => c.price.kind === 'unit_bands')!;
  if (bandCell.price.kind === 'unit_bands') bandCell.price = { ...bandCell.price,
    terms: [{ unit: 'output_tokens', centsPerUnit: 12 }, { unit: 'input_tokens', centsPerUnit: 1.5 }] };
  await assert.rejects(prepare(newBasis), /1\.1 price basis/i);
});

test('review receipt binds target, actor, candidate, policy, complete scope and one-time application', async () => {
  const prepared = await prepareOmni12TariffRelease({ state: omniPreviousTariffState(), ...omniReleaseIdentity });
  const identity = { ...omniReleaseIdentity, databaseIdentity: 'reviewed-target' };
  const receipt = { ...identity, policy: prepared.policy, fingerprint: prepared.fingerprint,
    sourceRevision: prepared.sourceRevision, updatedCells: 456, scope: prepared.scope };
  assert.doesNotThrow(() => assertOmni12ReleaseReview(receipt, identity));
  for (const patch of [{ candidateCommit: 'b'.repeat(40) }, { actorId: 'other' }, { databaseIdentity: 'other' },
    { policy: 'supplier-times-1.5' }, { fingerprint: '' }, { updatedCells: 455 }, { sourceRevision: -1 }, { scope: {} }]) {
    assert.throws(() => assertOmni12ReleaseReview({ ...receipt, ...patch }, identity), /review/i);
  }
  let queries = 0;
  await assert.rejects(applyOmni12TariffRelease({ query: async () => { queries++; return []; } } as unknown as TransactionQueryExecutor,
    { ...omniReleaseIdentity, authorizedActorId: omniReleaseIdentity.actorId, authorizedCandidateCommit: omniReleaseIdentity.candidateCommit,
      policy: prepared.policy, sourceRevision: prepared.sourceRevision, fingerprint: prepared.fingerprint }), /transaction|authorized/i);
  assert.equal(queries, 0);
});
