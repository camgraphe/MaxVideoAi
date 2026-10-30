import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import {readStudioAssistanceStatus} from '../frontend/src/server/studio/assistance-ledger';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;

test('new tasks pause for funding and continue once only after an explicit Lite approval',async t=>{
 const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
 const input=f.input('complex','Keep the approved vertical framing.');await service.enqueue(input);
 await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=500 WHERE user_id=$1',[actor.userId]);
 const models:string[]=[];
 const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{
  models.push(params.model!);assert.equal(params.reasoning?.effort,'high');assert.match(JSON.stringify(params.input),/approved vertical framing/);
  return {id:'explicit-lite',model:params.model!,status:'completed' as const,service_tier:'default',usage:{input_tokens:100,output_tokens:50,input_tokens_details:{cached_tokens:0}},output:[],output_text:JSON.stringify({reply:'Framing retained.'})};
 }}};
 await runStudioTaskWorkerOnce(worker);
 const paused=await service.read(input.requestId);assert.equal(paused.state,'paused');assert.equal(paused.error,'funding');assert.deepEqual(models,[]);
 const approval={requestId:input.requestId,approvalId:randomUUID(),expectedRevision:paused.revision,action:'continue_lite',maxCredits:paused.maxCredits,policyVersion:paused.policyVersion,confirmed:true};
 await f.pool.query('UPDATE studio_assistance_campaigns SET limit_nano_usd=0');
 await assert.rejects(service.resume(approval),(error:any)=>error.nextAction?.reason==='campaign_exhausted');
 assert.equal((await readStudioAssistanceStatus(actor.userId,f.policy)).selectedModel,'gpt-6.1-sol','Unavailable Lite must not change the account or approve a continuation');
 await f.pool.query('UPDATE studio_assistance_campaigns SET limit_nano_usd=$1',[f.policy.campaignNanoUsd]);
 const [accepted,replayed]=await Promise.all([service.resume(approval),service.resume(approval)]);
 assert.equal(accepted.model,'gpt-6-luna');assert.equal(replayed.revision,accepted.revision);
 const status=await readStudioAssistanceStatus(actor.userId,f.policy);assert.equal(status.selectedModel,'gpt-6-luna');
 assert.equal((await f.pool.query("SELECT count(*)::int n FROM studio_assistance_choices WHERE user_id=$1 AND action='select_luna'",[actor.userId])).rows[0].n,1);
 await runStudioTaskWorkerOnce(worker);assert.equal((await service.read(input.requestId)).state,'completed');assert.deepEqual(models,['gpt-6-luna']);
 assert.equal((await f.pool.query('SELECT model FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0].model,'gpt-6.1-sol','The original financial authorization remains immutable');
 assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE type='charge'")).rows[0].n,0);
 assert.equal(await runStudioTaskWorkerOnce(worker),false);
 await assert.rejects(service.resume({...approval,approvalId:randomUUID()}),/paused/);
});

test('an explicit Lite continuation retains completed tool work and cannot bypass unknown usage',async t=>{
 const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
 const input=f.input('standard','Remember the centered artwork and approved padding.');await service.enqueue(input);
 let counts=0;const models:string[]=[];
 await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,
  countInputTokens:async()=>{if(++counts===2)await f.pool.query('UPDATE studio_assistance_credit_lots SET consumed_credits=500 WHERE user_id=$1',[actor.userId]);return 100;},
  createActionResponse:async params=>{models.push(params.model!);return {id:'remember-artwork',model:params.model!,status:'completed',service_tier:'default',usage:{input_tokens:100,output_tokens:50,input_tokens_details:{cached_tokens:0}},output_text:'',output:[{type:'function_call',name:'project_remember',call_id:'remember-framing',arguments:JSON.stringify({revision:0,brief:'Centered artwork',decisions:['Preserve the approved padding.'],projectTitle:null})}]};}
 }});
 const paused=await service.read(input.requestId);assert.equal(paused.state,'paused');assert.equal(paused.error,'funding');assert.deepEqual(models,['gpt-6.1-sol']);
 const request={requestId:input.requestId,approvalId:randomUUID(),expectedRevision:paused.revision,action:'continue_lite',maxCredits:250,policyVersion:paused.policyVersion,confirmed:true};
 await assert.rejects(service.resume({...request,maxCredits:350}),/exact additional/);
 const other=await f.actor();await assert.rejects(createStudioTaskService(other,{enabled:true,assistancePolicy:f.policy}).resume(request),/not available/);
 await service.resume(request);
 await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async params=>{
  models.push(params.model!);assert.match(JSON.stringify(params.input),/Preserve the approved padding/);
  return {id:'finished-artwork',model:params.model!,status:'completed',service_tier:'default',usage:{input_tokens:100,output_tokens:50,input_tokens_details:{cached_tokens:0}},output_text:JSON.stringify({reply:'I kept the approved padding.'}),output:[]};
 }}});
 assert.equal((await service.read(input.requestId)).state,'completed');assert.deepEqual(models,['gpt-6.1-sol','gpt-6-luna']);
 assert.equal(Number((await f.pool.query('SELECT revision FROM studio_conversation_memory WHERE project_id=$1',[actor.projectId])).rows[0].revision),1);
 const next=f.input();await service.enqueue(next);
 await runStudioTaskWorkerOnce({enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{throw new Error('Lost provider response');}}});
 const unknown=await service.read(next.requestId);assert.equal(unknown.state,'unknown');
 await assert.rejects(service.resume({...request,requestId:next.requestId,approvalId:randomUUID(),expectedRevision:unknown.revision}),/paused/);
});
