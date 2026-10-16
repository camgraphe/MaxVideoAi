import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {chooseStudioAssistance,readStudioAssistanceStatus,reserveStudioAssistanceCall,settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';
import {STUDIO_TASK_POLICY_VERSION,STUDIO_TASK_LEGACY_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';

test('new Luna tasks reserve and settle 6000 output tokens while old tasks retain their frozen policy',async t=>{
  const f=await studioTaskFixture(t);
  async function lunaActor(){
    const actor=await f.actor(),status=await readStudioAssistanceStatus(actor.userId,f.policy);
    await chooseStudioAssistance(actor.userId,{action:'select_luna',expectedRevision:status.revision},f.policy);
    return actor;
  }
  const actor=await lunaActor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();
  await service.enqueue(input);
  const current=(await f.pool.query('SELECT policy_version,profile_json FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0];
  assert.equal(current.profile_json.reasoning,'high');
  assert.equal(current.profile_json.maxOutputTokens,6000);
  const workerId=randomUUID();
  await f.pool.query("UPDATE studio_tasks SET state='running',phase='thinking',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '5 minutes' WHERE request_id=$1",[input.requestId,workerId]);
  const call=await reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId:workerId,index:0,inputTokens:100,outputTokens:6000},f.policy);
  assert.equal(call.mode,'sponsored_luna');
  assert.equal(call.output_token_bound,6000);
  await settleStudioAssistanceCall(call.id,actor.userId,{id:'high-luna-reply',model:'gpt-6-luna',service_tier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:6000,output_tokens_details:{reasoning_tokens:5500}}});
  assert.equal((await service.read(input.requestId)).consumedCredits,0);
  assert.equal((await f.pool.query("SELECT count(*)::int n FROM app_receipts WHERE user_id=$1 AND type='charge'",[actor.userId])).rows[0].n,0);
  await assert.rejects(reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId:workerId,index:1,inputTokens:100,outputTokens:6001},f.policy),/bound|limit|output/i);

  const legacyActor=await lunaActor(),legacyService=createStudioTaskService(legacyActor,{enabled:true,assistancePolicy:f.policy}),baseLegacy=f.input();
  const legacyInput={...baseLegacy,taskBudget:{...baseLegacy.taskBudget,policyVersion:'studio-task-budget-2026-10-06-v1' as const}};
  await legacyService.enqueue(legacyInput);
  const legacy=(await f.pool.query('SELECT policy_version,profile_json FROM studio_tasks WHERE request_id=$1',[legacyInput.requestId])).rows[0];
  assert.equal(legacy.policy_version,'studio-task-budget-2026-10-06-v1');
  assert.equal(legacy.profile_json.reasoning,'medium');
  assert.equal(legacy.profile_json.maxOutputTokens,2200);
  await f.pool.query("UPDATE studio_tasks SET state='paused',phase='paused',error='steps' WHERE request_id=$1",[legacyInput.requestId]);
  await assert.rejects(legacyService.resume({requestId:legacyInput.requestId,approvalId:randomUUID(),expectedRevision:0,action:'continue',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true}),/policy|version/i);
  await legacyService.resume({requestId:legacyInput.requestId,approvalId:randomUUID(),expectedRevision:0,action:'continue',maxCredits:250,policyVersion:'studio-task-budget-2026-10-06-v1',confirmed:true});
  assert.deepEqual((await f.pool.query('SELECT profile_json FROM studio_tasks WHERE request_id=$1',[legacyInput.requestId])).rows[0].profile_json,legacy.profile_json);
});

test('the explicit Luna migration replays without rewriting tasks and rejects an unknown policy constraint',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  const input=f.input();
  await service.enqueue(input);
  const before=(await f.pool.query('SELECT policy_version,profile_json FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0];
  const migration=readFileSync('neon/migrations/67_studio_luna_reasoning.sql','utf8');
  await f.pool.query(migration);
  assert.deepEqual((await f.pool.query('SELECT policy_version,profile_json FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0],before);
  const client=await f.pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('ALTER TABLE studio_tasks DROP CONSTRAINT studio_tasks_policy_version_check');
    await client.query('ALTER TABLE studio_tasks ADD CONSTRAINT studio_tasks_policy_version_check CHECK (length(policy_version)>0)');
    await assert.rejects(client.query(migration),/Unexpected Studio task policy constraint/);
  }finally{await client.query('ROLLBACK');client.release();}
  assert.deepEqual((await f.pool.query('SELECT policy_version,profile_json FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0],before);
});

test('new Luna policy refuses dispatch before its explicit migration while the historical policy remains available',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy});
  await f.pool.query('DROP FUNCTION enforce_studio_task_resource_policy_v2() CASCADE');
  await assert.rejects(service.enqueue(f.input()),/explicit Studio task migration/);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_tasks')).rows[0].n,0);
  assert.equal((await f.pool.query('SELECT count(*)::int n FROM studio_assistance_calls')).rows[0].n,0);
  const oldInput=f.input();
  await service.enqueue({...oldInput,taskBudget:{...oldInput.taskBudget,policyVersion:STUDIO_TASK_LEGACY_POLICY_VERSION}});
  assert.equal((await service.read(oldInput.requestId)).policyVersion,STUDIO_TASK_LEGACY_POLICY_VERSION);
  await f.pool.query(readFileSync('neon/migrations/67_studio_luna_reasoning.sql','utf8'));
  const another=await f.actor();
  await createStudioTaskService(another,{enabled:true,assistancePolicy:f.policy}).enqueue(f.input());
});
