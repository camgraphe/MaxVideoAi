import {query,type QueryExecutor} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {ImageTurnInput} from '@/lib/studio/image-conversation-contract';
import {studioTaskStatusSchema,STUDIO_TASK_POLICY_VERSION,STUDIO_TASK_PROFILES,type StudioTaskStatus,type StudioTaskProfile} from '@/lib/studio/task-budget-contract';
import type {StudioAssistantModel} from '@/lib/studio/assistance-contract';
export type StudioTaskRow={user_id:string;project_id:string;request_id:string;segment_request_id:string;segment_max_calls?:number;input_hash:string;source_fingerprint:string;input_json:ImageTurnInput;profile:StudioTaskProfile;profile_json:typeof STUDIO_TASK_PROFILES[StudioTaskProfile];policy_version:typeof STUDIO_TASK_POLICY_VERSION;model:StudioAssistantModel;state:StudioTaskStatus['state'];phase:StudioTaskStatus['phase'];max_credits:number;allowed_calls:number;revision:number;worker_id:string|null;lease_expires_at:Date|null;deadline_at:Date|null;partial_reply:string|null;error:StudioTaskStatus['error'];created_at:Date;updated_at:Date;project_deleted?:Date|null;lease_valid?:boolean};
export async function studioTaskSchemaReady(db:QueryExecutor={query}) {
  return (await db.query<{ready:boolean}>("SELECT to_regclass('public.studio_tasks') IS NOT NULL ready"))[0]?.ready===true;
}
export async function readStudioTaskRow(actor:StudioGenerationActor,requestId:string,db:QueryExecutor={query},lock=false) {
  const row=(await db.query<StudioTaskRow>(`SELECT t.* FROM studio_tasks t JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
    WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$3${lock?' FOR UPDATE OF t':''}`,[actor.userId,actor.projectId,requestId]))[0];
  if(!row)throw new AgentApiError('REFERENCE_INVALID','This task is not available in this project.');return row;
}
export async function readStudioTaskUsage(row:Pick<StudioTaskRow,'user_id'|'project_id'|'request_id'>,db:QueryExecutor={query}) {
  const value=(await db.query<{consumed:string;reserved:string;completed:string;unknown:string}>(`SELECT
    COALESCE(sum(f.charged_cents),0)::text consumed,
    COALESCE(sum(f.quoted_cents) FILTER(WHERE f.charged_cents IS NULL),0)::text reserved,
    count(*) FILTER(WHERE c.state='settled')::text completed,
    count(*) FILTER(WHERE c.state<>'settled')::text unknown
    FROM studio_assistance_calls c LEFT JOIN studio_assistance_credit_funding f ON f.call_id=c.id
    WHERE c.user_id=$1 AND c.project_id=$2 AND c.request_id IN (SELECT request_id FROM studio_task_segments WHERE user_id=$1 AND project_id=$2 AND task_request_id=$3)
    AND NOT EXISTS(SELECT 1 FROM studio_assistance_resolutions w WHERE w.call_id=c.id AND w.action='waive_unknown')`,[row.user_id,row.project_id,row.request_id]))[0];
  return {consumedCredits:Number(value?.consumed??0)*10,reservedCredits:Number(value?.reserved??0)*10,completedCalls:Number(value?.completed??0),unknownCalls:Number(value?.unknown??0)};
}
export async function studioTaskFundingRequestIds(db:QueryExecutor,scope:{user_id:string;project_id:string;request_id:string}) {
  if(!await studioTaskSchemaReady(db))return [scope.request_id];
  const rows=await db.query<{request_id:string}>(`SELECT other.request_id FROM studio_task_segments current JOIN studio_task_segments other
    ON other.user_id=current.user_id AND other.project_id=current.project_id AND other.task_request_id=current.task_request_id
    WHERE current.user_id=$1 AND current.project_id=$2 AND current.request_id=$3`,[scope.user_id,scope.project_id,scope.request_id]);
  return rows.length?rows.map(row=>row.request_id):[scope.request_id];
}
export async function projectStudioTask(row:StudioTaskRow,db:QueryExecutor={query}):Promise<StudioTaskStatus> {
  const usage=await readStudioTaskUsage(row,db);
  return studioTaskStatusSchema.parse({requestId:row.request_id,profile:row.profile,policyVersion:row.policy_version,model:row.model,state:row.state,phase:row.phase,maxCredits:row.max_credits,
    consumedCredits:usage.consumedCredits,reservedCredits:usage.reservedCredits,completedCalls:usage.completedCalls,allowedCalls:row.allowed_calls,revision:row.revision,error:row.error,
    canContinue:row.state==='paused'&&usage.unknownCalls===0&&row.allowed_calls<24});
}
