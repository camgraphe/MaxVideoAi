import assert from 'node:assert/strict';
import test from 'node:test';
import { studioProjectEntryUrl } from '../frontend/app/(core)/(workspace)/app/studio/projects/studio-conversation-entry';

test('connected projects reopen conversation only when enabled and without a pending media import', () => {
  assert.equal(studioProjectEntryUrl({ id: 'project_a', persistenceMode: 'connected' }, true, ''), '/app/studio/conversation/project_a');
  assert.equal(studioProjectEntryUrl({ id: 'project_a', persistenceMode: 'connected' }, false, ''), '/app/studio/workspace/project_a');
  assert.equal(studioProjectEntryUrl({ id: 'project_a', persistenceMode: 'connected' }, true, '?studioMedia=asset%2Btoken'), '/app/studio/workspace/project_a?studioMedia=asset%2Btoken');
  assert.equal(studioProjectEntryUrl({ id: 'project_a', persistenceMode: 'connected' }, true, '?studioMedia='), '/app/studio/workspace/project_a');
});

test('local and legacy projects retain canvas entry and imported media stays intact', () => {
  for (const persistenceMode of ['local-only', 'legacy', undefined] as const) {
    assert.equal(studioProjectEntryUrl({ id: 'project_a', persistenceMode }, true, ''), '/app/studio/workspace/project_a');
    assert.equal(studioProjectEntryUrl({ id: 'project_a', persistenceMode }, true, '?studioMedia=asset%2Btoken'), '/app/studio/workspace/project_a?studioMedia=asset%2Btoken');
  }
  assert.equal(studioProjectEntryUrl({ id: 'project with/slash', persistenceMode: 'connected' }, true, ''), '/app/studio/conversation/project%20with%2Fslash');
});
