import assert from 'node:assert/strict';
import test from 'node:test';
import {studioProjectEntryUrl} from '../frontend/app/(core)/(workspace)/app/studio/_lib/studio-conversation-entry';

test('connected project entry opens only the supported conversational interface',()=>{
  assert.equal(studioProjectEntryUrl({id:'project_a',persistenceMode:'connected'}),'/app/studio/conversation/project_a');
  assert.equal(studioProjectEntryUrl({id:'project_a',persistenceMode:'connected'},false),'/app/studio');
  assert.equal(studioProjectEntryUrl({id:'project with/slash',persistenceMode:'connected'}),'/app/studio/conversation/project%20with%2Fslash');
});
test('retired private and local project entries return to Studio',()=>{
  for(const persistenceMode of ['local-only','legacy',undefined])assert.equal(studioProjectEntryUrl({id:'private',persistenceMode}),'/app/studio');
});
