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

test('renaming requires the authenticated account and origin; names and request bodies are bounded',async()=>{
  const url='http://localhost:4320/api/studio/conversation-projects';let calls=0;
  const options={enabled:true,resolveAccess:async()=>({ok:true as const,userId:'owner'}),rename:async(actor:{userId:string;projectId:string},input:{name:unknown;idempotencyKey:string})=>{calls++;assert.equal(actor.userId,'owner');assert.equal(actor.projectId,'film');return {projectId:actor.projectId,name:String(input.name),updatedAt:'2026-10-05T12:00:00Z'};}};
  const request=(body:unknown,origin='http://localhost:4320')=>new NextRequest(url,{method:'PATCH',headers:{origin},body:typeof body==='string'?body:JSON.stringify(body)});
  const valid={projectId:'film',name:'My perfume film',idempotencyKey:'rename-1'};
  assert.equal((await handleStudioConversationEditing(request(valid),'rename',undefined,{...options,resolveAccess:async()=>({ok:false,status:401,error:'UNAUTHORIZED'})})).status,401);
  assert.equal((await handleStudioConversationEditing(request(valid),'rename',undefined,{...options,enabled:false})).status,404);
  assert.equal((await handleStudioConversationEditing(request(valid,'https://foreign.example'),'rename',undefined,options)).status,403);
  for(const body of [{...valid,userId:'foreign'},{...valid,name:''},{...valid,name:'a'.repeat(201)},{...valid,name:'One\nTwo'}])assert.equal((await handleStudioConversationEditing(request(body),'rename',undefined,options)).status,400);
  assert.equal((await handleStudioConversationEditing(request('x'.repeat(12001)),'rename',undefined,options)).status,413);
  assert.equal(calls,0);
  const response=await handleStudioConversationEditing(request(valid),'rename',undefined,options);
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(calls,1);
});
