import assert from 'node:assert/strict';
import test from 'node:test';
import {NextRequest} from '../frontend/node_modules/next/server';
import {handleStudioMarketingEntry} from '../frontend/app/api/studio/marketing-entry/_lib/handle-studio-marketing-entry';
import {getAppMenuItems} from '../frontend/components/app/app-navigation';

test('ordinary Studio navigation and marketing entry open the chat, retaining explicit starters', async () => {
  assert.equal(getAppMenuItems(true,true).find(item=>item.id==='studio')?.href,'/app/studio');
  for (const query of ['', '?starter=invalid']) {
    const response=await handleStudioMarketingEntry(new NextRequest('http://localhost/api/studio/marketing-entry'+query),async()=>({ok:true,userId:'owner'}));
    assert.equal(response.headers.get('location'),'/app/studio');
  }
  const anonymous=await handleStudioMarketingEntry(new NextRequest('http://localhost/api/studio/marketing-entry'),async()=>({ok:false,status:401,error:'UNAUTHORIZED'}));
  assert.equal(anonymous.headers.get('location'),'/login?mode=signup&next=%2Fapp%2Fstudio');
});

test('project picker reads only bounded owned summaries and never sends workspace content', async () => {
  const module=await import('../frontend/src/server/studio/conversation-project-list').catch(()=>null);
  assert.ok(module?.listStudioConversationProjects,'project summary read owner exists');
  let reads=0;
  const projects=await module.listStudioConversationProjects('owner', {query:async(sql:string,params:unknown[])=>{
    reads++;
    assert.match(sql,/WHERE user_id = \$1/);
    assert.match(sql,/deleted_at IS NULL/);
    assert.match(sql,/LIMIT 100/);
    assert.doesNotMatch(sql,/workspace_state|\bCREATE\b|\bINSERT\b|\bUPDATE\b/i);
    assert.deepEqual(params,['owner']);
    return [{id:'project_1',name:'First cut',updated_at:new Date('2026-10-03T10:00:00Z'),persistence_mode:'connected',workspace_state:{private:'must not escape'}}];
  }} as never);
  assert.equal(reads,1);
  assert.deepEqual(projects,[{id:'project_1',name:'First cut',updatedAt:'2026-10-03T10:00:00.000Z',persistenceMode:'connected'}]);
});

test('picker GET enforces access and feature gates before reading and gives failures no empty-success fallback', async () => {
  const module=await import('../frontend/app/api/studio/_lib/studio-conversation-projects-handler').catch(()=>null);
  assert.ok(module?.handleStudioConversationProjects,'gated summary adapter exists');
  const request=new NextRequest('http://localhost/api/studio/conversation-projects');
  let reads=0;
  const list=async()=>{reads++;return [];};
  const denied=await module.handleStudioConversationProjects(request,{enabled:true,resolveAccess:async()=>({ok:false,status:401,error:'UNAUTHORIZED'}),list});
  assert.equal(denied.status,401);
  const disabled=await module.handleStudioConversationProjects(request,{enabled:false,resolveAccess:async()=>({ok:true,userId:'owner'}),list});
  assert.equal(disabled.status,404);
  assert.equal(reads,0);
  const failed=await module.handleStudioConversationProjects(request,{enabled:true,resolveAccess:async()=>({ok:true,userId:'owner'}),list:async()=>{throw new Error('database private detail');}});
  assert.equal(failed.status,503);
  assert.deepEqual(await failed.json(),{ok:false,error:'STUDIO_PROJECTS_UNAVAILABLE'});
  assert.match(failed.headers.get('cache-control')??'',/no-store/);
});
