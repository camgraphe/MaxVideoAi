import type {NextRequest} from 'next/server';
import {z,ZodError} from 'zod';
import {resolveStudioApiAccess} from '@/server/studio/access';
import {AgentApiError} from '@/server/agent-api/errors';
import {studioTaskResumeSchema,studioTaskMaintenanceSchema} from '@/lib/studio/task-budget-contract';
import {createStudioTaskService} from '@/server/studio/tasks/service';
import {readStudioConversationBody} from './studio-image-conversation-handler';
import {studioJson} from './studio-route-utils';
import {scheduleStudioWorker} from '@/server/studio/worker-host';
type TaskService={read(id:string):Promise<unknown>;resume(raw:unknown):Promise<unknown>;recover(raw:unknown):Promise<unknown>;cancel(raw:unknown):Promise<unknown>};
export async function handleStudioTask(req:NextRequest,projectId:string,requestId:string,operation:'read'|'mutate',dependencies:{resolveAccess?:typeof resolveStudioApiAccess;scheduleWorker?:typeof scheduleStudioWorker;serviceFactory?:(actor:Parameters<typeof createStudioTaskService>[0])=>TaskService}={}) {
  const access=await (dependencies.resolveAccess??resolveStudioApiAccess)(req);
  if(!access.ok)return studioJson({ok:false,error:access.error},{status:access.status});
  if(!projectId||projectId!==projectId.trim()||projectId.length>128||!z.string().uuid().safeParse(requestId).success)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
  if(operation!=='read'&&(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site'))return studioJson({ok:false,error:'SAME_ORIGIN_REQUIRED'},{status:403});
  try{
    const service=(dependencies.serviceFactory??createStudioTaskService)({authMethod:'studio-session',userId:access.userId,projectId,clientId:null});
    if(operation==='read')return studioJson({ok:true,result:await service.read(requestId)});
    const input=z.union([studioTaskResumeSchema,studioTaskMaintenanceSchema]).parse(await readStudioConversationBody(req));
    if(input.requestId!==requestId)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
    const result=input.action==='recover'?await service.recover(input):input.action==='cancel'?await service.cancel(input):await service.resume(input);
    if(input.action!=='cancel'&&result&&typeof result==='object'&&'state' in result&&result.state==='queued')
      (dependencies.scheduleWorker??scheduleStudioWorker)('task',{userId:access.userId,projectId,requestId});
    return studioJson({ok:true,result});
  }catch(error){
    if(error instanceof SyntaxError||error instanceof ZodError||error instanceof Error&&error.message==='INVALID_BODY')return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
    if(error instanceof Error&&error.message==='BODY_TOO_LARGE')return studioJson({ok:false,error:'BODY_TOO_LARGE'},{status:413});
    if(error instanceof AgentApiError)return studioJson({ok:false,error:error.code,message:error.message},{status:error.code==='SPENDING_LIMIT_EXCEEDED'?402:error.code==='RATE_LIMITED'?429:error.code==='ENGINE_UNAVAILABLE'?503:400});
    return studioJson({ok:false,error:'STUDIO_TASK_UNAVAILABLE',message:'The task is saved. Check its current status before retrying.'},{status:503});
  }
}
