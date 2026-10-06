import {query} from '@/lib/db';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {AgentApiError} from '@/server/agent-api/errors';
import {imageTurnInputSchema,type ImageConversation,type ImageConversationTurn} from '@/lib/studio/image-conversation-contract';
import {STUDIO_TASK_POLICY_VERSION} from '@/lib/studio/task-budget-contract';
import type {createImageConversationService} from '../image-conversation-service';
import {createStudioTaskService} from './service';
import {studioTaskSchemaReady,projectStudioTask,type StudioTaskRow} from './repository';
import {studioTasksEnabled} from './policy';

export function createStudioTaskConversationAdapter(actor:StudioGenerationActor,base:ReturnType<typeof createImageConversationService>,enabled=studioTasksEnabled()) {
  async function read():Promise<ImageConversation> {
    const conversation=await base.read();if(!await studioTaskSchemaReady())return conversation;
    const tasks=await query<StudioTaskRow>(`SELECT t.* FROM studio_tasks t JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL
      WHERE t.user_id=$1 AND t.project_id=$2 ORDER BY updated_at DESC LIMIT 30`,[actor.userId,actor.projectId]);
    const closed=await query<{request_id:string}>(`SELECT s.request_id FROM studio_task_segments s JOIN studio_tasks t ON t.user_id=s.user_id AND t.project_id=s.project_id AND t.request_id=s.task_request_id
      WHERE s.user_id=$1 AND s.project_id=$2 AND s.request_id<>t.segment_request_id`,[actor.userId,actor.projectId]);
    const closedIds=new Set(closed.map(row=>row.request_id));
    const turns=conversation.turns.map(turn=>closedIds.has(turn.requestId)?{...turn,continuation:undefined}:turn);
    for(const row of tasks){
      const task=await projectStudioTask(row),index=turns.findIndex(turn=>turn.requestId===row.segment_request_id);
      const active=['queued','running'].includes(task.state),failed=['failed','unknown'].includes(task.state);
      const existing=index>=0?turns[index]:null;
      const turn:ImageConversationTurn={...row.input_json,requestId:row.segment_request_id,reply:null,quote:null,generation:null,createdAt:new Date(row.updated_at).toISOString(),...existing,task,
        state:active?'thinking':failed?'failed':existing?.state??'ready',retryable:false};
      if(index>=0)turns[index]=turn;else turns.push(turn);
    }
    return {...conversation,turns:turns.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-30),...(enabled?{taskPolicyVersion:STUDIO_TASK_POLICY_VERSION}:{})};
  }
  return {read,async submit(raw:unknown){
    const input=imageTurnInputSchema.parse(raw);await createStudioTaskService(actor,{enabled}).enqueue(input);
    const conversation=await read();const turn=conversation.turns.find(turn=>turn.requestId===input.requestId)??conversation.turns.find(turn=>turn.task?.requestId===input.requestId);
    if(!turn)throw new AgentApiError('INTERNAL_ERROR','The queued request is saved. Refresh its conversation.');return turn;
  }};
}
