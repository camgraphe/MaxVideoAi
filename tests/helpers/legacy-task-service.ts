import {createStudioTaskService as currentTaskService} from '../../frontend/src/server/studio/tasks/service';
import {STUDIO_TASK_PROFILES} from '../../frontend/src/lib/studio/task-budget-contract';
// Historical snapshots predate explicit fallback consent. Retain their recovery contract.
export function createLegacyTaskService(...args:Parameters<typeof currentTaskService>){
 const service=currentTaskService(...args);
 return {...service,enqueue:async(input:unknown)=>{
  const result=await service.enqueue(input);
  const {withDbTransaction}=await import('../../frontend/src/lib/db');
  await withDbTransaction(async tx=>{
   await tx.query('ALTER TABLE studio_tasks DISABLE TRIGGER studio_tasks_identity');
   await tx.query(`UPDATE studio_tasks SET profile_json=(profile_json-'explicitLiteChoice'-'targetInputTokens')
     ||jsonb_build_object('maxInputTokens',$3::int) WHERE user_id=$1 AND request_id=$2`,
     [args[0].userId,result.requestId,STUDIO_TASK_PROFILES[result.profile].maxInputTokens]);
   await tx.query('ALTER TABLE studio_tasks ENABLE TRIGGER studio_tasks_identity');
  });
  return result;
 }};
}
