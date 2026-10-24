import assert from 'node:assert/strict';
import test from 'node:test';
import { assertVideoOperationReleaseReview } from '../frontend/scripts/_lib/video-operation-release-input';
import { VIDEO_OPERATION_TARIFF_POLICY, VIDEO_OPERATION_TARIFF_SCOPE } from '../frontend/server/pricing/video-operation-tariff-policy';

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
