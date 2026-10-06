import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {studioTaskFixture} from './helpers/studio-task-fixture';
import {createStudioTaskService} from '../frontend/src/server/studio/tasks/service';
import {replayStudioTaskAction} from '../frontend/src/server/studio/tasks/action-replay';
import {stableJson} from '../frontend/src/server/agent-api/generation-normalization';
import {STUDIO_TASK_POLICY_VERSION,STUDIO_TASK_PROFILES} from '../frontend/src/lib/studio/task-budget-contract';
import type {StudioTaskExecution} from '../frontend/src/server/studio/tasks/execution';

test('resumed tasks identify historical action receipts, preserving their data and scope',async t=>{
  const f=await studioTaskFixture(t),actor=await f.actor(),service=createStudioTaskService(actor,{enabled:true,assistancePolicy:f.policy}),input=f.input();await service.enqueue(input);
  const lease=randomUUID(),action={action:'timeline.edit' as const,sequenceId:'sequence',expectedRevision:0,edit:{kind:'move' as const,clipId:'clip',startFrame:30}};
  const result={ok:true,action:'timeline.edit',data:{projectId:actor.projectId,sequenceId:'sequence',revision:1,clipCount:1,totalFrames:60,changed:true,clip:{id:'clip',startFrame:30,durationFrames:30,sourceInFrame:0}}};
  await f.pool.query(`INSERT INTO studio_image_turns(user_id,project_id,request_id,request_hash,input_json,draft_json,draft_reference_fingerprint,state,lease_id,lease_expires_at)
    VALUES($1,$2,$3,$4,$5::jsonb,'{"reply":"One edit saved","image":null,"continuation":{"reason":"action_limit","completedEdits":1}}',$4,'ready',$6,now())`,[actor.userId,actor.projectId,input.requestId,'a'.repeat(64),JSON.stringify(input),lease]);
  await f.pool.query(`INSERT INTO studio_conversation_steps(user_id,project_id,request_id,call_id,lease_id,action_hash,action_json,observed_revision,state,result_json)
    VALUES($1,$2,$3,'saved-move',$4,$5,$6::jsonb,0,'completed',$7::jsonb)`,[actor.userId,actor.projectId,input.requestId,lease,createHash('sha256').update(stableJson(action)).digest('hex'),JSON.stringify(action),JSON.stringify(result)]);
  await f.pool.query("UPDATE studio_tasks SET state='paused',phase='paused',error='steps' WHERE request_id=$1",[input.requestId]);
  const approvalId=randomUUID();await service.resume({requestId:input.requestId,approvalId,expectedRevision:0,action:'continue',maxCredits:250,policyVersion:STUDIO_TASK_POLICY_VERSION,confirmed:true});
  const execution:StudioTaskExecution={taskRequestId:input.requestId,segmentRequestId:approvalId,workerId:randomUUID(),profile:STUDIO_TASK_PROFILES.standard,maxCalls:4,deadlineAt:new Date(Date.now()+300000),enabled:true};
  const saved=await replayStudioTaskAction(actor,execution,'saved-move',action);
  assert.equal(saved&&'replayed' in saved&&saved.replayed,true,'A historical receipt cannot be presented as a newly applied edit');
  assert.deepEqual(saved?.data,result.data);
  await assert.rejects(replayStudioTaskAction(actor,execution,'saved-move',{...action,edit:{...action.edit,startFrame:60}}),/changed operation/);
  assert.equal(await replayStudioTaskAction({...actor,userId:'foreign'},execution,'saved-move',action),null);
  assert.deepEqual((await f.pool.query("SELECT result_json FROM studio_conversation_steps WHERE call_id='saved-move'")).rows[0].result_json,result);
});
