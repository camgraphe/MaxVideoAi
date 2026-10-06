import test from 'node:test';
import assert from 'node:assert/strict';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {runStudioTaskWorkerOnce} from '../frontend/src/server/studio/tasks/worker';
import {inspectStudioAssistanceResolution,applyStudioAssistanceResolution} from '../frontend/src/server/studio/assistance-resolution';
import {settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';
import type {ImageGenerationFactory} from '../frontend/src/server/studio/image-conversation-service';
const generationFactory=(()=>({resolveReferences:async()=>[],walletSummary:async()=>({balanceCents:0,currency:'USD'}),catalog:async()=>[],getQuote:async()=>null})) as unknown as ImageGenerationFactory;
const response={id:'recorded',model:'gpt-6.1-sol',status:'completed' as const,service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:50},output_text:JSON.stringify({reply:'Recovered requested answer.'}),output:[]};
test('a live expired worker reports its late waived response without reopening or charging the task',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),s=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();await s.enqueue(input);
  let entered!:()=>void,finish!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;}),released=new Promise<void>(resolve=>{finish=resolve;});let calls=0;
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;entered();await released;return response;}}};
  const pending=runStudioTaskWorkerOnce(worker);await started;
  try{
    await f.pool.query("UPDATE studio_tasks SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
    await f.pool.query("UPDATE studio_image_turns SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE request_id=$1",[input.requestId]);
    assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal((await s.read(input.requestId)).state,'unknown');
    const call=(await f.pool.query('SELECT id FROM studio_assistance_calls WHERE request_id=$1',[input.requestId])).rows[0];
    const preview=await inspectStudioAssistanceResolution(call.id,'waive_unknown');await applyStudioAssistanceResolution({callId:call.id,action:'waive_unknown',expectedFingerprint:preview.fingerprint,operator:'offline-live-fence',reason:'Expired owned task lease; release customer hold'});
    assert.equal((await s.read(input.requestId)).error,'closed');
  }finally{finish();await pending;}
  const closed=await s.read(input.requestId);assert.equal(closed.state,'failed');assert.equal(closed.consumedCredits,0);assert.equal(closed.reservedCredits,0);assert.equal(calls,1);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM studio_conversation_responses WHERE request_id=$1 AND state='reported'",[input.requestId])).rows[0].n,1,'Late usage snapshot survives the revoked worker');
  assert.equal((await s.enqueue(f.input())).state,'queued');
});
test('support waiver closes the unknown task, releases account blocking and fences late completion',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),s=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();await s.enqueue(input);
  let calls=0;const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;throw new Error('Lost supplier response');}}};
  await runStudioTaskWorkerOnce(worker);assert.equal((await s.read(input.requestId)).state,'unknown');
  const call=(await f.pool.query('SELECT id FROM studio_assistance_calls WHERE request_id=$1',[input.requestId])).rows[0];
  const old=(await f.pool.query('SELECT worker_id FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0].worker_id;
  const preview=await inspectStudioAssistanceResolution(call.id,'waive_unknown'),approval={callId:call.id,action:'waive_unknown',expectedFingerprint:preview.fingerprint,operator:'offline-task-test',reason:'Lost reply; customer reservation explicitly released'};
  await applyStudioAssistanceResolution(approval);
  const closed=await s.read(input.requestId);assert.equal(closed.state,'failed');assert.equal(closed.error,'closed');assert.equal(closed.reservedCredits,0);
  assert.equal((await applyStudioAssistanceResolution(approval)).applied,false);
  // This is the production worker's final update fence: the revoked worker cannot reopen it.
  assert.equal((await f.pool.query("UPDATE studio_tasks SET state='completed',phase='done' WHERE request_id=$1 AND worker_id=$2 AND state IN ('running','unknown') RETURNING request_id",[input.requestId,old])).rowCount,0);
  await settleStudioAssistanceCall(call.id,actor.userId,response);
  assert.equal((await s.read(input.requestId)).state,'failed');assert.equal((await s.read(input.requestId)).consumedCredits,0,'Late known usage cannot charge a waived reservation');
  assert.equal(await runStudioTaskWorkerOnce(worker),false);assert.equal(calls,1);
  assert.equal((await s.enqueue(f.input())).state,'queued','Support closeout releases the account for a new explicit task');
});
test('operator settlement of held usage queues only stored-result replay without another provider call',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),s=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();await s.enqueue(input);let calls=0;
  await f.pool.query(`CREATE FUNCTION fail_known_settlement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Controlled unavailable settlement'; END; $$;
    CREATE TRIGGER fail_known_settlement BEFORE UPDATE ON studio_assistance_credit_funding FOR EACH ROW EXECUTE FUNCTION fail_known_settlement();`);
  const worker={enabled:true,assistancePolicy:f.policy,serviceOptions:{generationFactory,countInputTokens:async()=>100,createActionResponse:async()=>{calls++;return response;}}};
  for(let n=0;n<4;n++)await runStudioTaskWorkerOnce(worker);
  assert.equal((await s.read(input.requestId)).state,'unknown');assert.equal((await s.read(input.requestId)).error,'usage');
  await f.pool.query('DROP TRIGGER fail_known_settlement ON studio_assistance_credit_funding; DROP FUNCTION fail_known_settlement()');
  const call=(await f.pool.query('SELECT id FROM studio_assistance_calls WHERE request_id=$1',[input.requestId])).rows[0];
  const preview=await inspectStudioAssistanceResolution(call.id,'settle_recorded');await applyStudioAssistanceResolution({callId:call.id,action:'settle_recorded',expectedFingerprint:preview.fingerprint,operator:'offline-task-test',reason:'Scoped known response confirmed'});
  assert.equal((await s.read(input.requestId)).state,'queued');assert.equal((await f.pool.query('SELECT replay_only FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0].replay_only,true);
  await runStudioTaskWorkerOnce({...worker,enabled:false,serviceOptions:{...worker.serviceOptions,createActionResponse:async()=>{throw new Error('Never buy another response after settlement');}}});
  const recovered=await s.read(input.requestId);assert.equal(recovered.state,'completed');assert.equal(recovered.reservedCredits,0);assert.equal(calls,1);
  assert.equal((await s.enqueue(f.input())).state,'queued');
});
