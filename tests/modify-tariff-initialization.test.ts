import assert from 'node:assert/strict';
import test from 'node:test';
import type { ManualTariffCell } from '@maxvideoai/pricing';
import type { TransactionQueryExecutor } from '../frontend/src/lib/db';
import { prepareModifyTariffs, applyModifyTariffs, MODIFY_TARIFF_POLICY } from '../frontend/server/pricing/modify-tariffs';
import { assertModifyReleaseReview } from '../frontend/scripts/_lib/modify-release-input';
import { modifyTariffFixture, modifyReleaseIdentity, modifyPolicy } from './helpers/modify-tariff-fixture';

test('Modify preparation freezes exactly 49 canonical cells and preserves source tariffs', async () => {
  const state = modifyTariffFixture();
  const before = structuredClone(state);
  const prepared = await prepareModifyTariffs({ ...modifyReleaseIdentity, state, policy: modifyPolicy });
  assert.equal(prepared.cells.length, 49);
  assert.equal(new Set(prepared.cells.map(cell => JSON.stringify(cell.selector))).size, 49);
  assert.deepEqual(state, before);
  const amounts = (engineId: string, resolution: string) => prepared.cells.filter(cell =>
    cell.selector.engineId === engineId && cell.selector.resolution === resolution)
    .sort((a, b) => Number(a.selector.durationSec) - Number(b.selector.durationSec))
    .map(cell => (cell.price as { customerCents: number }).customerCents);
  assert.deepEqual(amounts('kling-o3-standard', '720p'), [50, 66, 82, 99, 115, 132, 148, 164, 181, 197, 214, 229, 246]);
  // Literal expectations intentionally live outside the canonical calculator.
  assert.deepEqual(amounts('luma-ray-3-2', '540p'), [113, 132, 150, 169, 206, 225, 244, 263, 281, 300, 319, 337]);
  assert.deepEqual(amounts('luma-ray-3-2', '720p'), [169, 197, 225, 253, 309, 337, 366, 394, 422, 450, 478, 506]);
  assert.deepEqual(amounts('luma-ray-3-2', '1080p'), [337, 394, 450, 506, 618, 674, 731, 787, 843, 899, 955, 1011]);
  assert.deepEqual(prepared.basis.lumaIntermediateSupplierCost, { status: 'unknown', amountUsd: null });
  assert.equal(prepared.cells.some(cell => cell.selector.hdr || cell.selector.exrExport), false);
  assert.equal((await prepareModifyTariffs({ ...modifyReleaseIdentity, state, policy: modifyPolicy,
    at: '2026-10-22T00:00:00.000Z' })).fingerprint, prepared.fingerprint);
});

test('Modify preparation rejects existing variants, missing/changed anchors and policy failures', async () => {
  const state = modifyTariffFixture();
  const input = { ...modifyReleaseIdentity, state, policy: modifyPolicy };
  const prepared = await prepareModifyTariffs(input);
  for (const patch of [{ active: false }, { revision: -1 }, { databaseCells: state.databaseCells.slice(1) },
    { databaseCells: [...state.databaseCells, prepared.cells[0]!] },
    { versionedCells: [{ ...prepared.cells[0]!, effectiveUntil: '2026-10-01T00:00:00.000Z' }] }]) {
    await assert.rejects(prepareModifyTariffs({ ...input, state: { ...state, ...patch } }));
  }
  const changed = structuredClone(state);
  const anchor = changed.databaseCells.find(cell => cell.selector.engineId === 'luma-ray-3-2')!;
  anchor.price = { kind: 'fixed', customerCents: 95 };
  await assert.rejects(prepareModifyTariffs({ ...input, state: changed }), /anchor/i);
  await assert.rejects(prepareModifyTariffs({ ...input, policy: { status: 'unavailable', rules: [], errorCode: 'pricing_rules_query_failed' } }), /policy/i);
  await assert.rejects(prepareModifyTariffs({ ...input, at: '2099-01-01' }), /date/i);
  const collision: ManualTariffCell = { ...state.databaseCells[0]!, id: prepared.cells[0]!.id,
    selector: { ...state.databaseCells[0]!.selector, resolution: '4k' } };
  await assert.rejects(prepareModifyTariffs({ ...input, state: { ...state, databaseCells: [...state.databaseCells, collision] } }), /existing|identity/i);
});

test('Modify review binds full scope, source state, policy, actor, candidate and database', async () => {
  const state = modifyTariffFixture();
  const input = { ...modifyReleaseIdentity, state, policy: modifyPolicy };
  const prepared = await prepareModifyTariffs(input);
  const identity = { ...modifyReleaseIdentity, databaseIdentity: 'target', releaseBranch: 'codex/marketing-media' };
  const receipt = { ...identity, ...prepared, insertedCells: 49, existingPricesChanged: false };
  assert.doesNotThrow(() => assertModifyReleaseReview(receipt, identity));
  assert.doesNotThrow(() => assertModifyReleaseReview(receipt, identity, receipt));
  const editedReceipt = structuredClone(receipt);
  editedReceipt.cells[0]!.price = { kind: 'fixed', customerCents: 1 };
  assert.throws(() => assertModifyReleaseReview(editedReceipt, identity, receipt), /review/i);
  for (const patch of [{ actorId: 'other' }, { candidateCommit: 'b'.repeat(40) }, { databaseIdentity: 'other' }, { releaseBranch: 'codex/other' },
    { policy: 'other' }, { fingerprint: '' }, { sourceRevision: -1 }, { insertedCells: 48 },
    { existingPricesChanged: true }, { scope: {} }]) {
    assert.throws(() => assertModifyReleaseReview({ ...receipt, ...patch }, identity), /review/i);
  }
  const changed = structuredClone(state);
  changed.databaseCells[0]!.version++;
  assert.notEqual((await prepareModifyTariffs({ ...input, state: changed })).fingerprint, prepared.fingerprint);
  assert.notEqual((await prepareModifyTariffs({ ...input, candidateCommit: 'b'.repeat(40) })).fingerprint, prepared.fingerprint);
  let calls = 0;
  const executor = { query: async () => { calls++; return []; } } as unknown as TransactionQueryExecutor;
  await assert.rejects(applyModifyTariffs(executor, { ...modifyReleaseIdentity,
    authorizedActorId: modifyReleaseIdentity.actorId, authorizedCandidateCommit: modifyReleaseIdentity.candidateCommit,
    policy: MODIFY_TARIFF_POLICY, fingerprint: prepared.fingerprint, sourceRevision: state.revision }), /transaction/i);
  assert.equal(calls, 0);
});
