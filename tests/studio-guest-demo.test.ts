import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {canVisitorBrowseWorkspacePath} from '../frontend/lib/visitor-access';
import {stageGuestCreation,consumeGuestCreation} from '../frontend/lib/guest-creation-continuation';

test('guests can open the Studio demonstration without opening private projects or APIs',()=>{
  assert.equal(canVisitorBrowseWorkspacePath('/app/studio'),true);
  assert.equal(canVisitorBrowseWorkspacePath('/app/studio/'),true);
  for(const path of ['/app/studio/conversation/private','/app/studio/workspace/private','/api/studio/conversation-projects','/api/studio/chat']) assert.equal(canVisitorBrowseWorkspacePath(path),false,path);
  const entry=readFileSync('frontend/app/(core)/(workspace)/app/studio/page.tsx','utf8');
  assert.match(entry,/<StudioGuestDemo/);
  assert.doesNotMatch(entry,/status===401\)redirect/);
});

test('Studio resumes only the explicit guest text once and never a demo asset or paid action',async()=>{
  const module=await import('../frontend/app/(core)/(workspace)/app/studio/_lib/studio-guest-draft').catch(()=>null);
  assert.ok(module,'Studio owns a bounded text-only continuation');
  const values=new Map<string,string>();
  const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
  const token='10000000-0000-4000-8000-000000000001';
  const payload=module.serializeStudioGuestDraft('My own product, not the demo');
  assert.equal(stageGuestCreation(storage,'/app/studio',payload,token,100),true);
  assert.equal(consumeGuestCreation(storage,'/app',token,200),null);
  assert.equal(module.parseStudioGuestDraft(consumeGuestCreation(storage,'/app/studio',token,200)),'My own product, not the demo');
  assert.equal(consumeGuestCreation(storage,'/app/studio',token,200),null);
  for(const raw of [null,'not json','{"message":42}','{"message":""}',JSON.stringify({message:'x'.repeat(4001)})])assert.equal(module.parseStudioGuestDraft(raw),null);
  assert.equal(module.parseStudioGuestDraft('{"message":"My brief","assets":["demo-product"],"confirm":true}'),'My brief');
  assert.equal(module.studioGuestContinuationToken([token]),null);
  assert.equal(module.studioGuestContinuationToken('untrusted'),null);
  assert.equal(module.studioGuestContinuationToken(token),token);
});

test('a guest continuation gets a new owned conversation instead of the most recent project',()=>{
  const entry=readFileSync('frontend/app/(core)/(workspace)/app/studio/page.tsx','utf8');
  assert.match(entry,/recent&&!starter&&!continuationToken/);
  const start=readFileSync('frontend/app/(core)/(workspace)/app/studio/_components/StudioStart.client.tsx','utf8');
  assert.match(start,/continueDraft/);
  const conversation=readFileSync('frontend/app/(core)/(workspace)/app/studio/conversation/[projectId]/StudioImageConversation.client.tsx','utf8');
  assert.match(conversation,/consumeGuestCreationFromLocation\('\/app\/studio'\)/);
  assert.doesNotMatch(conversation,/consumeGuestCreationFromLocation[\s\S]{0,250}studio\.submit/);
});
