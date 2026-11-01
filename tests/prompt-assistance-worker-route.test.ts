import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {NextRequest} from 'next/server';
import {handlePromptAssistance} from '../frontend/src/server/prompt-assistance/route-handler';

test('admission acknowledges before the wakeup and every recovery remains owner-scoped',async()=>{
 const sessionId=randomUUID(),requestId=randomUUID(),scheduled:unknown[]=[],seen:unknown[]=[];
 const pending={state:'pending',phase:'queued',sessionId,requestId,deadlineAt:new Date(Date.now()+600_000).toISOString()};
 const req=(body:unknown)=>new NextRequest('https://example.test/api/prompt-assistance',{method:'POST',headers:{origin:'https://example.test'},body:JSON.stringify(body)});
 const deps={enabled:true,access:async()=>({ok:true as const,userId:'authenticated-owner'}),
  send:async(owner:string)=>{seen.push(owner);return pending;},recover:async(owner:string,s:string,r:string)=>{seen.push([owner,s,r]);return pending;},
  schedule:(scope:unknown)=>{scheduled.push(scope);}};
 const request={sessionId,requestId,draftRevision:0,locale:'en',message:'An astronomy-club film.',draft:{surface:'video',engineId:'seedance-2-5',mode:'t2v',target:'prompt',text:'',settings:{},references:[]}};
 const sent=await handlePromptAssistance(req({action:'message',request}),deps as never);
 assert.equal(sent.status,200);assert.equal((await sent.json()).result.phase,'queued');
 assert.deepEqual(seen,['authenticated-owner']);assert.deepEqual(scheduled,[{userId:'authenticated-owner',sessionId,requestId}]);
 const recovered=await handlePromptAssistance(req({action:'recover',sessionId,requestId}),deps as never);
 assert.equal(recovered.status,200);assert.deepEqual(seen[1],['authenticated-owner',sessionId,requestId]);assert.equal(scheduled.length,2);
});

test('completed replies are not dispatched, and wakeup loss cannot lose admission',async()=>{
 const sessionId=randomUUID(),requestId=randomUUID();let schedules=0;
 const req=new NextRequest('https://example.test/api/prompt-assistance',{method:'POST',headers:{origin:'https://example.test'},body:JSON.stringify({action:'recover',sessionId,requestId})});
 const response=await handlePromptAssistance(req,{enabled:true,access:async()=>({ok:true,userId:'owner'}),recover:async()=>({state:'complete'}),schedule:()=>{schedules++;}} as never);
 assert.equal(response.status,200);assert.equal(schedules,0);
 const retry=new NextRequest('https://example.test/api/prompt-assistance',{method:'POST',headers:{origin:'https://example.test'},body:JSON.stringify({action:'recover',sessionId,requestId})});
 const admitted=await handlePromptAssistance(retry,{enabled:true,access:async()=>({ok:true,userId:'owner'}),recover:async()=>({state:'pending',sessionId,requestId}),schedule:()=>{throw Error('Synthetic lost wakeup');}} as never);
 assert.equal(admitted.status,200);assert.equal((await admitted.json()).result.state,'pending');
});

test('cron requires the existing secret, activation and production execution scope',async()=>{
 const module=await import('../frontend/app/api/cron/_lib/prompt-assistance-worker-handler').catch(()=>null);
 assert.ok(module,'durable saved admissions need their authenticated cron fallback');
 let runs=0;const run=async()=>{runs++;return true;};
 const req=(token?:string)=>new NextRequest('https://example.test/api/cron/prompt-assistance',{headers:token?{authorization:`Bearer ${token}`}:{}});
 for(const env of [{},{CRON_SECRET:'fixture-secret',PROMPT_ASSISTANCE_WORKERS_ENABLED:'true'}]){
  assert.equal((await module.handlePromptAssistanceWorkerCron(req(),{env,run})).status,401);
 }
 assert.equal((await module.handlePromptAssistanceWorkerCron(req('wrong'),{env:{CRON_SECRET:'fixture-secret'},run})).status,401);
 const disabled=await module.handlePromptAssistanceWorkerCron(req('fixture-secret'),{env:{CRON_SECRET:'fixture-secret'},run});assert.equal((await disabled.json()).handled,false);
 const preview=await module.handlePromptAssistanceWorkerCron(req('fixture-secret'),{env:{CRON_SECRET:'fixture-secret',PROMPT_ASSISTANCE_WORKERS_ENABLED:'true',VERCEL_ENV:'preview'},run});assert.equal((await preview.json()).handled,false);assert.equal(runs,0);
 const production=await module.handlePromptAssistanceWorkerCron(req('fixture-secret'),{env:{CRON_SECRET:'fixture-secret',PROMPT_ASSISTANCE_WORKERS_ENABLED:'true',VERCEL_ENV:'production'},run});assert.equal((await production.json()).handled,true);assert.equal(runs,1);
});
