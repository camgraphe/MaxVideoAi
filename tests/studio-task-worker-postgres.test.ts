import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
import {STUDIO_TASK_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';

const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
const response=(id:string,reply='Requested answer')=>({id,model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply}),output:[]});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}
test('an immediate wake-up cannot process another queued account or request',async t=>{
  const f=await studioTaskFixture(t),a=await f.actor(),b=await f.actor();
  const first=createStudioTaskService(a,{enabled:true,assistancePolicy:f.policy}),second=createStudioTaskService(b,{enabled:true,assistancePolicy:f.policy});
  const i=f.input(),j=f.input();await first.enqueue(i);await second.enqueue(j);
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>response('scoped')}};
  assert.equal(await runStudioTaskWorkerOnce({...worker,scope:{...a,requestId:j.requestId}}),false);
  assert.equal((await first.read(i.requestId)).state,'queued');
  assert.equal(await runStudioTaskWorkerOnce({...worker,scope:{...b,requestId:j.requestId}}),true);
  assert.equal((await first.read(i.requestId)).state,'queued');assert.equal((await second.read(j.requestId)).state,'completed');
});

test('task worker alone dispatches, saves progress and resumes under the same cumulative budget',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input('quick'),task=await service.enqueue(input);let calls=0;
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;return response('one');}}};
  assert.equal(calls,0);await service.read(task.requestId);assert.equal(calls,0);
  assert.equal(await runStudioTaskWorkerOnce(worker),true);
  assert.equal((await service.read(task.requestId)).state,'completed');assert.equal(calls,1);
  assert.equal(await runStudioTaskWorkerOnce(worker),false);await service.enqueue(input);assert.equal(calls,1);
  const a=await f.actor(),s=createStudioTaskService(a,{enabled:true,assistancePolicy:f.policy}),i=f.input('quick');await s.enqueue(i);let partialCalls=0;
  const partial={...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{partialCalls++;return { ...response('partial-'+partialCalls),output_text:'',output:[{type:'function_call' as const,name:'project_read',call_id:'read-'+partialCalls,arguments:'{}'}]};}}};
  await runStudioTaskWorkerOnce(partial);
  const paused=await s.read(i.requestId);assert.equal(paused.state,'paused');assert.equal(paused.completedCalls,2);
  const old=(await f.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[i.requestId])).rows[0].draft_json;assert.ok(old.continuation);
  const approval={requestId:i.requestId,approvalId:randomUUID(),expectedRevision:paused.revision,action:'continue',maxCredits:100,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true};
  await s.resume(approval);
  await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async params=>{calls++;assert.match(JSON.stringify(params.input),/completed|saved|previous/i);return response('continued','Finished the remaining requested answer.');}}});
  assert.equal((await s.read(i.requestId)).state,'completed');assert.equal((await s.read(i.requestId)).completedCalls,3);
  assert.deepEqual((await f.pool.query('SELECT draft_json FROM studio_image_turns WHERE request_id=$1',[i.requestId])).rows[0].draft_json,old,'Prior partial replies are immutable');
  await assert.rejects(s.resume({...approval,approvalId:randomUUID(),expectedRevision:1}),/paused|completed/);
});
test('expired live dispatch retains a late known response; lost usage never redispatches',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),s=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),i=f.input();await s.enqueue(i);
  const entered=deferred(),finish=deferred();let calls=0;
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;entered.resolve();await finish.promise;return response('late');}}};
  const first=runStudioTaskWorkerOnce(worker);await entered.promise;
  try{
    await f.pool.query("UPDATE studio_tasks SET lease_expires_at=now()-interval '1 second' WHERE request_id=$1",[i.requestId]);
    assert.equal(await runStudioTaskWorkerOnce(worker),false);
    assert.equal((await s.read(i.requestId)).state,'unknown');
  }finally{finish.resolve();await first;}
  assert.equal((await s.read(i.requestId)).state,'completed');assert.equal(calls,1);
  const a=await f.actor(),unknown=createStudioTaskService(a,{enabled:true,assistancePolicy:f.policy}),u=f.input();await unknown.enqueue(u);
  await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{calls++;throw new Error('Lost supplier reply');}}});
  assert.equal((await unknown.read(u.requestId)).state,'unknown');
  assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal(calls,2);
  await assert.rejects(unknown.resume({requestId:u.requestId,approvalId:randomUUID(),expectedRevision:0,action:'extend',maxCredits:350,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true}),/paused|usage/);
});
test('saved known usage settles with task dispatch disabled, while oversized context pauses without spending',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),s=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),i=f.input();await s.enqueue(i);let calls=0;
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;return response('saved');}}};
  await f.pool.query(`CREATE FUNCTION interrupt_task_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Controlled lost settlement'; END; $$;
    CREATE TRIGGER interrupt_task_settlement BEFORE UPDATE ON studio_assistance_credit_funding FOR EACH ROW EXECUTE FUNCTION interrupt_task_settlement();`);
  await runStudioTaskWorkerOnce(worker);assert.equal((await s.read(i.requestId)).state,'unknown');
  await f.pool.query('DROP TRIGGER interrupt_task_settlement ON studio_assistance_credit_funding; DROP FUNCTION interrupt_task_settlement()');
  await runStudioTaskWorkerOnce({...worker,enabled:false,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{throw new Error('Do not redispatch saved output');}}});
  assert.equal((await s.read(i.requestId)).state,'completed');assert.equal(calls,1);assert.equal((await s.read(i.requestId)).reservedCredits,0);
  const a=await f.actor(),p=createStudioTaskService(a,{enabled:true,assistancePolicy:f.policy}),large=f.input('complex');await p.enqueue(large);
  await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,countInputTokens:async()=>48001}});
  const paused=await p.read(large.requestId);assert.equal(paused.state,'paused');assert.equal(paused.error,'context');assert.equal(paused.consumedCredits,0);assert.equal(calls,1);
  const b=await f.actor(),invalid=createStudioTaskService(b,{enabled:true,assistancePolicy:f.policy}),bad=f.input();await invalid.enqueue(bad);
  await runStudioTaskWorkerOnce({...worker,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{calls++;return {...response('invalid'),model:'unexpected-model'};}}});
  assert.equal((await invalid.read(bad.requestId)).state,'unknown');
  assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal(calls,2,'Unqualified known output cannot trigger another paid call');
});
test('persistent receipt-storage failures pause after bounded recovery without buying another response',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),s=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),i=f.input();await s.enqueue(i);let calls=0;
  await f.pool.query(`CREATE FUNCTION fail_task_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Controlled persistent receipt failure'; END; $$;
    CREATE TRIGGER fail_task_receipt BEFORE UPDATE ON studio_conversation_steps FOR EACH ROW EXECUTE FUNCTION fail_task_receipt();`);
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;return {...response('recorded-read'),output_text:'',output:[{type:'function_call' as const,name:'project_read',call_id:'recorded-read',arguments:'{}'}]};}}};
  for(let n=0;n<4;n++)await runStudioTaskWorkerOnce(worker);
  assert.equal((await s.read(i.requestId)).state,'paused');assert.equal(calls,1,'A saved read is replayed, never repurchased');
  assert.equal(await runStudioTaskWorkerOnce(worker),false);
});
