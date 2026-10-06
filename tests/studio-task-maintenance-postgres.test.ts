import test from 'node:test';
import assert from 'node:assert/strict';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {STUDIO_TASK_POLICY_VERSION} from '../frontend/src/lib/studio/task-budget-contract';
test('queued cancellation is scoped, idempotent and cannot cancel a running paid task',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),s=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();await s.enqueue(input);
  const command={requestId:input.requestId,expectedRevision:0,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true,action:'cancel'};
  const other=createStudioTaskService(await f.actor(),{enabled:true,assistancePolicy:f.policy});await assert.rejects(other.cancel(command),/available/);
  assert.equal((await s.cancel(command)).error,'cancelled');assert.equal((await s.cancel(command)).consumedCredits,0);
  const next=f.input();await s.enqueue(next);await f.pool.query("UPDATE studio_tasks SET state='running' WHERE request_id=$1",[next.requestId]);
  await assert.rejects(s.cancel({...command,requestId:next.requestId}),/waiting|queued/);
});
test('recovery never queues missing usage or expands approved resources',async t=>{
  const f=await studioTaskFixture(t),s=createStudioTaskService(await f.actor(),{enabled:true,assistancePolicy:f.policy}),input=f.input();await s.enqueue(input);
  await f.pool.query("UPDATE studio_tasks SET state='unknown',phase='unknown',error='usage' WHERE request_id=$1",[input.requestId]);
  await assert.rejects(s.recover({requestId:input.requestId,expectedRevision:0,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true,action:'recover'}),/saved|usage/);
  assert.equal((await s.read(input.requestId)).state,'unknown');assert.equal((await s.read(input.requestId)).allowedCalls,4);
});
