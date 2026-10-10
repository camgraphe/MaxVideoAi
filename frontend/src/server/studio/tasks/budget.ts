import type {QueryExecutor} from '@/lib/db';
import {studioTaskProfileForModel} from '@/lib/studio/task-budget-contract';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {studioTaskSchemaReady,type StudioTaskRow} from './repository';
import {StudioTaskStop} from './policy';
import {studioTaskSourceFingerprint} from './source';

/** Called under the existing campaign/account lock, through the dispatch transaction. */
export async function readStudioTaskBudget(db:QueryExecutor,scope:{userId:string;projectId:string;requestId:string;leaseId:string}) {
  if(!await studioTaskSchemaReady(db))return null;
  const row=(await db.query<StudioTaskRow>(`SELECT t.*,s.max_calls segment_max_calls,p.deleted_at project_deleted,
    (t.lease_expires_at>clock_timestamp() AND t.deadline_at>clock_timestamp()) lease_valid
    FROM studio_tasks t JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id
    JOIN studio_task_segments s ON s.user_id=t.user_id AND s.project_id=t.project_id AND s.task_request_id=t.request_id
    WHERE s.user_id=$1 AND s.project_id=$2 AND s.request_id=$3 FOR SHARE OF t,p`,[scope.userId,scope.projectId,scope.requestId]))[0];
  if(!row)return null;
  if(row.project_deleted)throw new StudioTaskStop('permission','This project is no longer available.');
  if(row.state!=='running'||row.worker_id!==scope.leaseId||row.segment_request_id!==scope.requestId)throw new StudioTaskStop('permission','This task worker lease or segment was superseded.');
  if(!row.lease_valid)throw new StudioTaskStop('deadline','This task reached its current time allowance.');
  try{
    const selection=row.input_json.taskBudget;
    if(!selection||selection.policyVersion!==row.policy_version||selection.profile!==row.profile
      ||stableJson(row.profile_json)!==stableJson(studioTaskProfileForModel(selection,row.model)))throw new Error('Resource policy changed');
  }catch{throw new StudioTaskStop('unavailable','This task resource policy is not available.');}
  try{
    const fingerprint=await studioTaskSourceFingerprint({userId:scope.userId,projectId:scope.projectId,authMethod:'studio-session',clientId:null},row.input_json,db,true);
    if(fingerprint!==row.source_fingerprint)throw new Error('Source changed');
  }catch{throw new StudioTaskStop('permission','A selected source changed or is no longer available. Send a new reviewed request.');}
  return row;
}
export function enforceStudioTaskBounds(task:StudioTaskRow|null,input:{index:number;inputTokens:number;outputTokens:number},dispatched:number) {
  if(!task)return;
  if(input.index>=(task.segment_max_calls??task.profile_json.maxCalls)||dispatched>=(task.segment_max_calls??task.profile_json.maxCalls))throw new StudioTaskStop('steps','This task reached its approved step allowance.');
  if(input.inputTokens>task.profile_json.maxInputTokens)throw new StudioTaskStop('context','This context needs a smaller source selection or request.');
  if(input.outputTokens>task.profile_json.maxOutputTokens)throw new StudioTaskStop('output','This call exceeds the approved output allowance.');
}
export function enforceStudioTaskQuote(task:StudioTaskRow|null,customerTotalCents:number) {
  if(task&&customerTotalCents*10>task.max_credits)throw new StudioTaskStop('budget','The next call would exceed this task credit ceiling.');
}
