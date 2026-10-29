import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {chooseStudioAssistance,reserveStudioAssistanceCall,settleStudioAssistanceCall} from '../frontend/src/server/studio/assistance-ledger';

test('all three Studio task levels persist and settle the exact runtime; historical tasks retain their limits',async t=>{
 const f=await studioTaskFixture(t);
 for(const [action,model,effort] of [['select_luna','gpt-6-luna','high'],['select_terra','gpt-6.1-terra','high'],['select_sol','gpt-6.1-sol','xhigh']] as const){
  const actor=await f.actor();await chooseStudioAssistance(actor.userId,{action,expectedRevision:0},f.policy);
  const service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();await service.enqueue(input);
  const row=(await f.pool.query('SELECT * FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0];
  assert.equal(row.model,model);assert.equal(row.profile_json.reasoning,effort);assert.equal(row.profile_json.maxOutputTokens,6000);
  const leaseId=randomUUID();await f.pool.query("UPDATE studio_tasks SET state='running',worker_id=$2,lease_expires_at=now()+interval '3 minutes',deadline_at=now()+interval '5 minutes' WHERE request_id=$1",[input.requestId,leaseId]);
  const call=await reserveStudioAssistanceCall({...actor,requestId:input.requestId,leaseId,index:0,inputTokens:1000,outputTokens:6000},f.policy);
  assert.equal(call.output_token_bound,6000);assert.equal(call.model,model);
  assert.equal(await settleStudioAssistanceCall(call.id,actor.userId,{id:randomUUID(),model,service_tier:'default',usage:{input_tokens:1000,input_tokens_details:{cached_tokens:0},output_tokens:4000,output_tokens_details:{reasoning_tokens:3000}}}),true);
 }
 const actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();
 await service.enqueue({...input,taskBudget:{...input.taskBudget,policyVersion:'studio-task-budget-2026-10-11-v2'}});
 const old=(await f.pool.query('SELECT profile_json FROM studio_tasks WHERE request_id=$1',[input.requestId])).rows[0].profile_json;
 assert.equal(old.reasoning,'medium');assert.equal(old.maxOutputTokens,2200);
 const next=await f.actor();await f.pool.query('DROP FUNCTION enforce_studio_task_resource_policy_v3() CASCADE');
 await assert.rejects(createStudioTaskService(next,{enabled:true,assistancePolicy:f.policy}).enqueue(f.input()),/explicit Studio task migration/);
});
