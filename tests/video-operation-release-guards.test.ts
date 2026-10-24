import assert from 'node:assert/strict';
import test from 'node:test';
import { assertVideoOperationReleaseReview } from '../frontend/scripts/_lib/video-operation-release-input';
import { VIDEO_OPERATION_TARIFF_POLICY, VIDEO_OPERATION_TARIFF_SCOPE } from '../frontend/server/pricing/video-operation-tariff-policy';
import { prepareVideoOperationTariffs } from '../frontend/server/pricing/video-operation-tariffs';
import { operationIdentity, operationPolicy, operationTariffState } from './helpers/video-operation-tariff-fixture';

test('operation receipt binds actor, target, candidate, current revision, complete scope and literal proposal', () => {
  const identity = { actorId:'11111111-1111-4111-8111-111111111111',candidateCommit:'a'.repeat(40),
    databaseIdentity:'sha256:target',releaseBranch:'codex/video-provider-mode-parity' };
  const review = {...identity,policy:VIDEO_OPERATION_TARIFF_POLICY,fingerprint:'b'.repeat(64),sourceRevision:1798,
    insertedCells:89,existingPricesChanged:false,approved:false,activationReady:false,scope:VIDEO_OPERATION_TARIFF_SCOPE};
  assert.doesNotThrow(() => assertVideoOperationReleaseReview(review,identity,review));
  for (const change of [{actorId:'other'},{candidateCommit:'c'.repeat(40)},{databaseIdentity:'other'},
    {releaseBranch:'codex/other'},{policy:'other'},{fingerprint:'short'},{sourceRevision:-1},{insertedCells:88},
    {existingPricesChanged:true},{approved:true},{activationReady:true},{scope:{}}]) {
    assert.throws(() => assertVideoOperationReleaseReview({...review,...change},identity,review));
  }
  assert.throws(() => assertVideoOperationReleaseReview(review,identity,{...review,sourceRevision:1799}));
  assert.throws(() => assertVideoOperationReleaseReview({...review,cells:[{price:1}]},identity,{...review,cells:[{price:2}]}));
});

test('changing both receipt and selected identity cannot reuse approval for an identical cloned grid', async () => {
  const prepare = async (identity: typeof operationIdentity) => {
    const prepared = await prepareVideoOperationTariffs({ ...identity, state: operationTariffState(), policy: operationPolicy,
      at: '2026-10-24T00:00:00Z' });
    return { ...identity, policy: prepared.policy, fingerprint: prepared.fingerprint, sourceRevision: prepared.sourceRevision,
      scope: prepared.scope, insertedCells: prepared.cells.length, existingPricesChanged: false, approved: false, activationReady: false,
      cells: prepared.cells, sourceStateHash: prepared.sourceStateHash };
  };
  const reviewed = await prepare(operationIdentity);
  for (const changed of [{ databaseIdentity: 'd'.repeat(64) }, { releaseBranch: 'codex/other-release' }]) {
    const identity = { ...operationIdentity, ...changed }, current = await prepare(identity);
    const substitutedReceipt = { ...reviewed, ...changed };
    assert.deepEqual(current.cells, reviewed.cells);
    assert.equal(current.sourceStateHash, reviewed.sourceStateHash);
    assert.equal(substitutedReceipt.fingerprint, reviewed.fingerprint);
    assert.throws(() => assertVideoOperationReleaseReview(substitutedReceipt, identity, current), /identity or scope changed/i);
    assert.doesNotThrow(() => assertVideoOperationReleaseReview(current, identity, current));
  }
});
