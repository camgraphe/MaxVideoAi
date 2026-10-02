import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {handleStudioConversationEditing} from '../frontend/app/api/studio/_lib/studio-conversation-editing-handler';

test('native editing guards account, gate, origin and bounded scope before any mutation',async () => {
  const url = 'http://localhost:4320/api/studio/projects/film/conversation-timeline';
  let mutations = 0;
  const edit = (async () => {mutations++;return {projectId: 'film',sequenceId: 'seq',revision: 1,clipCount: 1,totalFrames: 30};}) as any;
  const options = {enabled: true,resolveAccess: async () => ({ok: true as const,userId: 'owner'}),edit};
  const req = (body: string,origin = 'http://localhost:4320') => new NextRequest(url,{method: 'POST',headers: {origin},body});
  assert.equal((await handleStudioConversationEditing(req('{}'),'edit','film',{...options,resolveAccess: async () => ({ok: false,status: 401,error: 'UNAUTHORIZED'})})).status,401);
  assert.equal((await handleStudioConversationEditing(req('{}'),'edit','film',{...options,enabled: false})).status,404);
  assert.equal((await handleStudioConversationEditing(req('{}','https://foreign.example'),'edit','film',options)).status,403);
  assert.equal((await handleStudioConversationEditing(req('a'.repeat(12001)),'edit','film',options)).status,413);
  const payload = {sequenceId: 'seq',expectedRevision: 0,idempotencyKey: 'key',edit: {kind: 'move',clipId: 'clip',startFrame: 30}};
  assert.equal((await handleStudioConversationEditing(req(JSON.stringify({...payload,projectId: 'foreign'})),'edit','film',options)).status,400);
  assert.equal(mutations,0);
  const valid = await handleStudioConversationEditing(req(JSON.stringify(payload)),'edit','film',options);
  assert.equal(valid.status,200);
  assert.equal(mutations,1);
  assert.equal(valid.headers.get('cache-control'),'private, no-store');
});
