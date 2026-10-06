import {randomUUID} from 'node:crypto';
import {query,withDbTransaction} from '@/lib/db';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {createImageConversationService} from '../image-conversation-service';
import {studioTaskSavedUsageKnown} from './saved-usage';
import {studioAssistancePolicy,type StudioAssistancePolicy} from '../assistance-policy';
import {studioTaskSchemaReady,readStudioTaskUsage,type StudioTaskRow} from './repository';
import {studioTasksEnabled,StudioTaskStop} from './policy';
import type {StudioTaskExecution} from './execution';

type ServiceOptions=Omit<Parameters<typeof createImageConversationService>[1],'enabled'|'actionsEnabled'|'assistancePolicy'|'taskExecution'>;
type WorkerDependencies={enabled?:boolean;assistancePolicy?:StudioAssistancePolicy;serviceOptions?:ServiceOptions};
/** Only a worker runs this entry. UI status reads never call it. */
export async function runStudioTaskWorkerOnce(dependencies:WorkerDependencies={}):Promise<boolean> {
  if(!await studioTaskSchemaReady())return false;
  const candidate=(await query<StudioTaskRow>(`SELECT t.* FROM studio_tasks t WHERE state='queued' OR (state='running' AND lease_expires_at<=clock_timestamp())
    OR (state='unknown' AND error='provider' AND EXISTS(SELECT 1 FROM studio_conversation_responses r WHERE r.user_id=t.user_id AND r.project_id=t.project_id AND r.request_id=t.segment_request_id AND r.state='reported'))
    ORDER BY created_at LIMIT 1`))[0];
  if(!candidate)return false;
  const workerId=randomUUID();
  const row=await withDbTransaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`studio-image:${candidate.user_id}`]);
    const current=(await tx.query<StudioTaskRow>(`SELECT * FROM studio_tasks WHERE user_id=$1 AND project_id=$2 AND request_id=$3
      AND (state='queued' OR state='unknown' AND error='provider' OR state='running' AND lease_expires_at<=clock_timestamp()) FOR UPDATE SKIP LOCKED`,[candidate.user_id,candidate.project_id,candidate.request_id]))[0];
    if(!current)return null;
    if(current.recovery_attempts>=2){await tx.query("UPDATE studio_tasks SET state=CASE WHEN state='unknown' THEN 'unknown' ELSE 'paused' END,phase=CASE WHEN state='unknown' THEN 'unknown' ELSE 'paused' END,error=CASE WHEN state='unknown' THEN 'usage' ELSE 'provider' END WHERE user_id=$1 AND project_id=$2 AND request_id=$3",[current.user_id,current.project_id,current.request_id]);return null;}
    const usage=await readStudioTaskUsage(current,tx);
    if(usage.unknownCalls){
      const known=await studioTaskSavedUsageKnown(current,tx);
      if(!known){await tx.query("UPDATE studio_tasks SET state='unknown',phase='unknown',error=$4,updated_at=clock_timestamp() WHERE user_id=$1 AND project_id=$2 AND request_id=$3",[current.user_id,current.project_id,current.request_id,current.state==='running'?'provider':'usage']);return null;}
    }
    const now=(await tx.query<{now:Date}>('SELECT clock_timestamp() now'))[0].now;
    const deadline=current.deadline_at??new Date(now.getTime()+current.profile_json.deadlineSec*1000);
    return (await tx.query<StudioTaskRow>(`UPDATE studio_tasks SET state='running',phase=$4,worker_id=$5,lease_expires_at=clock_timestamp()+interval '3 minutes',deadline_at=$6,recovery_attempts=recovery_attempts+CASE WHEN deadline_at IS NULL THEN 0 ELSE 1 END,updated_at=clock_timestamp()
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 RETURNING *`,[current.user_id,current.project_id,current.request_id,current.deadline_at?'recovering':'thinking',workerId,deadline]))[0];
  });
  if(!row)return false;
  const actor:StudioGenerationActor={userId:row.user_id,projectId:row.project_id,authMethod:'studio-session',clientId:null};
  const scope=[row.user_id,row.project_id,row.request_id,workerId];
  let renewing=false;
  const heartbeat=setInterval(()=>{
    if(renewing)return;renewing=true;
    void query(`UPDATE studio_tasks SET lease_expires_at=clock_timestamp()+interval '3 minutes',updated_at=clock_timestamp()
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND worker_id=$4 AND state='running'
      AND EXISTS(SELECT 1 FROM studio_projects p WHERE p.id=studio_tasks.project_id AND p.user_id=studio_tasks.user_id AND p.deleted_at IS NULL)`,scope)
      .then(()=>query(`UPDATE studio_image_turns SET lease_expires_at=clock_timestamp()+interval '3 minutes' WHERE user_id=$1 AND project_id=$2 AND request_id=$5 AND lease_id=$4 AND state='thinking'
        AND EXISTS(SELECT 1 FROM studio_tasks WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND worker_id=$4 AND state='running')`,[...scope,row.segment_request_id]))
      .catch(()=>undefined).finally(()=>{renewing=false;});
  },30_000);
  try{
    const segment=(await query<{max_calls:number}>('SELECT max_calls FROM studio_task_segments WHERE user_id=$1 AND project_id=$2 AND request_id=$3',[row.user_id,row.project_id,row.segment_request_id]))[0];
    const previousWork=await query<NonNullable<StudioTaskExecution['previousWork']>[number]>(`SELECT action_json->>'action' action,call_id AS "callId",true completed,
      CASE WHEN action_json->>'action'='timeline.edit' THEN action_json ELSE NULL END details FROM studio_conversation_steps
      WHERE user_id=$1 AND project_id=$2 AND request_id IN (SELECT request_id FROM studio_task_segments WHERE user_id=$1 AND project_id=$2 AND task_request_id=$3 AND request_id<>$4)
      AND state='completed' AND result_json->>'ok'='true' ORDER BY created_at DESC LIMIT 12`,[row.user_id,row.project_id,row.request_id,row.segment_request_id]);
    const execution:StudioTaskExecution={taskRequestId:row.request_id,segmentRequestId:row.segment_request_id,workerId,profile:row.profile_json,maxCalls:segment.max_calls,deadlineAt:row.deadline_at!,enabled:dependencies.enabled??studioTasksEnabled(),locale:row.input_json.locale,recoveryOnly:row.replay_only||row.deadline_at!.getTime()<=Date.now(),previousWork};
    const service=createImageConversationService(actor,{enabled:true,actionsEnabled:true,assistancePolicy:dependencies.assistancePolicy??studioAssistancePolicy(),
      mediaEnabled:process.env.STUDIO_CONVERSATION_MEDIA_ENABLED==='true',editingEnabled:process.env.STUDIO_CONVERSATION_EDITING_ENABLED==='true',exportsEnabled:process.env.STUDIO_CONVERSATION_EXPORTS_ENABLED==='true',
      ...dependencies.serviceOptions,taskExecution:execution});
    const turn=await service.submit({...row.input_json,requestId:row.segment_request_id});
    const usage=await readStudioTaskUsage(row),paused=!!turn.continuation;
    const code=turn.continuation?.lastError?.code;
    const reason=code?.startsWith('TASK_')?code.slice(5).toLowerCase():turn.continuation?.reason==='output_limit'?'output':'steps';
    await query(`UPDATE studio_tasks SET state=$5,phase=$6,error=$7,partial_reply=$8,lease_expires_at=NULL,updated_at=clock_timestamp()
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND worker_id=$4 AND state IN ('running','unknown')`,[...scope,usage.unknownCalls?'unknown':paused?'paused':'completed',usage.unknownCalls?'unknown':paused?'paused':'done',usage.unknownCalls?'usage':paused?reason:null,turn.reply]);
    return true;
  }catch(error){
    const usage=await readStudioTaskUsage(row);
    const reports=await query(`SELECT response_id FROM studio_conversation_responses WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND state='reported'`,[row.user_id,row.project_id,row.segment_request_id]);
    const reason=error instanceof StudioTaskStop?error.reason:'provider';
    // Known saved output can settle/replay within the original deadline. Unknown
    // usage must not acquire another provider identity or release its hold.
    await query(`UPDATE studio_tasks SET state=$5,phase=$6,error=$7,lease_expires_at=NULL,updated_at=clock_timestamp()
      WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND worker_id=$4 AND state IN ('running','unknown')`,[...scope,usage.unknownCalls?'unknown':reports.length?row.recovery_attempts>=2?'paused':'queued':'failed',usage.unknownCalls?'unknown':reports.length&&row.recovery_attempts<2?'recovering':'paused',usage.unknownCalls?reports.length&&row.recovery_attempts<2?'provider':'usage':reason]);
    return true;
  }finally{clearInterval(heartbeat);}
}
