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
test('a follow-up question keeps the last unapplied Milo proposal available for the next edit', () => {
  let state = previewReducer(initial(), { type: 'send', id: 1, message: 'A dog chases a car' });
  state = previewReducer(state, { type: 'reply', id: 1, text: 'A dog runs behind a slow car.', reply: 'Here is a prompt.' });
  state = previewReducer(state, { type: 'send', id: 2, message: 'Replace the dog with a cat' });
  state = previewReducer(state, { type: 'reply', id: 2, text: null, reply: 'Should it be realistic?' });
  assert.equal(state.proposal?.text, 'A dog runs behind a slow car.');
  assert.equal(canApplyProposal(state), true);
  state = previewReducer(state, { type: 'sync', scope: state.scope, fingerprint: 'editor changed' });
  assert.equal(canApplyProposal(state), false);
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

test('a failed delivered request keeps its human message with an honest delivery notice', () => {
  let state = previewReducer(initial(), {type:'send',id:3,message:'Keep this detailed creative brief.'});
  state = previewReducer(state, {type:'failed',id:3});
  assert.equal(state.messages.length,1);
  assert.equal(state.messages[0].text,'Keep this detailed creative brief.');
  assert.equal((state.messages[0] as {deliveryFailed?:boolean}).deliveryFailed,true);
  assert.equal(state.messages.some(message=>message.role==='assistant'),false);
  assert.equal(state.proposal,null);
});

test('a failed restored turn cannot become the owner of an older completed proposal', async () => {
  const session = await import('../frontend/src/lib/prompt-assistance/session');
  const completed = '00000000-0000-4000-8000-000000000001';
  const failed = '00000000-0000-4000-8000-000000000002';
  const snapshot = {sessionId:'00000000-0000-4000-8000-000000000003',scope:'video:create',status:'active',
    turns:[{requestId:completed,message:'First idea',reply:'A real response'},
      {requestId:failed,message:'A later unanswered brief',state:'failed',reply:null,error:'REQUEST_UNANSWERED'}],proposal:null,pending:null};
  assert.equal(session.promptSessionSnapshotSchema.safeParse(snapshot).success,true);
  const latest = (session as unknown as {lastCompletedPromptRequestId:(snapshot:unknown)=>string}).lastCompletedPromptRequestId;
  assert.equal(typeof latest,'function');
  assert.equal(latest(snapshot),completed);
  assert.equal(latest({...snapshot,turns:[snapshot.turns[1]]}),'');
});
