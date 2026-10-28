import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreviewState, previewReducer, canApplyProposal, canUndoProposal, previewEnabled } from '../frontend/src/lib/prompt-assistance/preview-state';

const initial = () => createPreviewState('account-a:video', 'original');
test('late suggestions cannot overwrite a changed draft and retired scopes cannot display a reply', () => {
  let state = previewReducer(initial(), { type: 'send', id: 1, message: 'Refine this' });
  state = previewReducer(state, { type: 'sync', scope: state.scope, fingerprint: 'changed settings' });
  state = previewReducer(state, { type: 'reply', id: 1, text: 'New prompt', reply: 'Sample reply' });
  assert.equal(canApplyProposal(state), false);
  state = previewReducer(state, { type: 'sync', scope: 'account-b:video', fingerprint: 'other draft' });
  state = previewReducer(state, { type: 'reply', id: 1, text: 'Wrong account', reply: 'Old reply' });
  assert.equal(state.messages.length, 0);
  assert.equal(state.proposal, null);
});
test('the full edited suggestion is retained and undo is invalidated by an intervening change', () => {
  let state = previewReducer(initial(), { type: 'send', id: 2, message: 'Refine' });
  state = previewReducer(state, { type: 'reply', id: 2, text: 'x'.repeat(4000), reply: 'Sample' });
  assert.equal(canApplyProposal(state), true);
  assert.equal(state.proposal?.text.length, 4000);
  state = previewReducer(state, { type: 'applied', previous: 'original', fingerprint: 'applied' });
  assert.equal(canUndoProposal(state), true);
  state = previewReducer(state, { type: 'sync', scope: state.scope, fingerprint: 'edited' });
  assert.equal(canUndoProposal(state), false);
});
test('workspace changes clear the transcript and a prior request cannot replace a newer one', () => {
  let state = previewReducer(initial(), { type: 'send', id: 1, message: 'First' });
  state = previewReducer(state, { type: 'sync', scope: 'account-a:audio:voice', fingerprint: 'other' });
  state = previewReducer(state, { type: 'send', id: 2, message: 'Second' });
  state = previewReducer(state, { type: 'reply', id: 1, text: 'Old', reply: 'Old' });
  assert.equal(state.pending?.id, 2);
  assert.equal(state.proposal, null);
});
test('simulation is opt-in and never enabled by the flag in production or test', () => {
  assert.equal(previewEnabled('development', '1'), true);
  for (const env of ['production', 'test', undefined]) assert.equal(previewEnabled(env, '1'), false);
  assert.equal(previewEnabled('development', undefined), false);
});
