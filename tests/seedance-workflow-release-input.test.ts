import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSeedanceWorkflowReleaseReview } from '../frontend/scripts/_lib/seedance-workflow-release-input';

const identity = { actorId: 'aaaa1111-1111-4111-8111-aaaaaaaaaaaa', candidateCommit: 'a'.repeat(40), databaseIdentity: 'b'.repeat(64) };
const review = { ...identity, policy: 'clone_current_normal_multimodal_prices_v1', fingerprint: 'c'.repeat(64), sourceRevision: 1, insertedCells: 1620 };
test('workflow initialization binds the reviewed actor, candidate and database without an ambient target', () => {
  assert.doesNotThrow(() => assertSeedanceWorkflowReleaseReview(review, identity));
  for (const changed of [{ actorId: 'bbbb1111-1111-4111-8111-aaaaaaaaaaaa' }, { candidateCommit: 'd'.repeat(40) }, { databaseIdentity: 'e'.repeat(64) }]) {
    assert.throws(() => assertSeedanceWorkflowReleaseReview(review, { ...identity, ...changed }));
  }
  for (const changed of [{ sourceRevision: -1 }, { insertedCells: 0 }, { fingerprint: '' }, { policy: 'silent_normal_fallback' }]) {
    assert.throws(() => assertSeedanceWorkflowReleaseReview({ ...review, ...changed }, identity));
  }
});
