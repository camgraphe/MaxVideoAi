import {query} from '@/lib/db';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {StudioTaskRow} from './repository';
import {StudioTaskStop} from './policy';
export type StudioTaskExecution={taskRequestId:string;segmentRequestId:string;workerId:string;profile:StudioTaskRow['profile_json'];maxCalls:number;deadlineAt:Date;enabled:boolean;recoveryOnly?:boolean;locale?:'en'|'fr'|'es';previousWork?:{action:string;callId:string;completed:true;details?:unknown}[]};
/** Checked before token counting; reservation rechecks source/project/lease atomically. */
export async function assertStudioTaskExecution(actor:StudioGenerationActor,execution:StudioTaskExecution) {
  const row=(await query<{alive:boolean}>(`SELECT t.state='running' AND t.worker_id=$4 AND t.segment_request_id=$3
    AND t.lease_expires_at>clock_timestamp() AND p.deleted_at IS NULL alive FROM studio_tasks t
    JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id WHERE t.user_id=$1 AND t.project_id=$2 AND t.request_id=$5`,[actor.userId,actor.projectId,execution.segmentRequestId,execution.workerId,execution.taskRequestId]))[0];
  if(!row?.alive)throw new StudioTaskStop('permission','This task worker was superseded or the project is unavailable.');
  if(!execution.enabled)throw new StudioTaskStop('unavailable','New task dispatch is currently unavailable. Saved work is retained.');
  if(execution.recoveryOnly||Date.now()>=execution.deadlineAt.getTime())throw new StudioTaskStop('deadline','This task reached its approved time allowance.');
}
export async function setStudioTaskPhase(actor:StudioGenerationActor,execution:StudioTaskExecution,phase:StudioTaskRow['phase']) {
  await query('UPDATE studio_tasks SET phase=$5,updated_at=clock_timestamp() WHERE user_id=$1 AND project_id=$2 AND request_id=$3 AND worker_id=$4 AND state=\'running\'',[actor.userId,actor.projectId,execution.taskRequestId,execution.workerId,phase]);
}
