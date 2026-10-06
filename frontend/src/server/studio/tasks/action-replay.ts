import {createHash} from 'node:crypto';
import {query} from '@/lib/db';
import {AgentApiError} from '@/server/agent-api/errors';
import {stableJson} from '@/server/agent-api/generation-normalization';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import type {StudioActionRequest,StudioActionResult} from '@/lib/studio/conversation-action-contract';
import type {StudioTaskExecution} from './execution';
/** An explicitly reused old call identity replays its receipt, never its mutation. */
export async function replayStudioTaskAction(actor:StudioGenerationActor,execution:StudioTaskExecution,callId:string,action:StudioActionRequest) {
  const saved=(await query<{action_hash:string;result_json:StudioActionResult}>(`SELECT c.action_hash,c.result_json FROM studio_conversation_steps c
    JOIN studio_task_segments s ON s.user_id=c.user_id AND s.project_id=c.project_id AND s.request_id=c.request_id
    JOIN studio_projects p ON p.id=c.project_id AND p.user_id=c.user_id AND p.deleted_at IS NULL
    WHERE c.user_id=$1 AND c.project_id=$2 AND s.task_request_id=$3 AND c.request_id<>$4 AND c.call_id=$5 AND c.state='completed'
    ORDER BY c.created_at DESC LIMIT 1`,[actor.userId,actor.projectId,execution.taskRequestId,execution.segmentRequestId,callId]))[0];
  if(!saved)return null;
  if(saved.action_hash!==createHash('sha256').update(stableJson(action)).digest('hex'))throw new AgentApiError('PARAMETER_INVALID','A saved action identity cannot be reused for a changed operation.');
  return {...saved.result_json,replayed:true as const};
}
