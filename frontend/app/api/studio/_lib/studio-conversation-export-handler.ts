import type {NextRequest} from 'next/server';
import {resolveStudioApiAccess} from '@/server/studio/access';
import {confirmStudioTimelineExport,asStudioExportAgentError,StudioExportCommandError} from '@/server/studio/conversation-export-command';
import {studioExportConfirmationSchema} from '@/lib/studio/conversation-export-contract';
import {AgentApiError} from '@/server/agent-api/errors';
import {LIVE_PRICING_POLICY_REVISION,PRICING_POLICY_HEADER} from '@/lib/membership-policy';
import {studioConversationEditingEnabled} from './studio-conversation-editing-handler';
import {studioJson} from './studio-route-utils';
export async function handleStudioConversationExportConfirmation(req:NextRequest,projectId:string,dependencies:{enabled?:boolean;resolveAccess?:typeof resolveStudioApiAccess;confirm?:typeof confirmStudioTimelineExport}={}){
  const access=await (dependencies.resolveAccess??resolveStudioApiAccess)(req);
  if(!access.ok)return studioJson({ok:false,error:access.error},{status:access.status});
  if(!(dependencies.enabled??(studioConversationEditingEnabled()&&process.env.STUDIO_CONVERSATION_EXPORTS_ENABLED==='true')))return studioJson({ok:false,error:'STUDIO_EXPORTS_UNAVAILABLE'},{status:404});
  if(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site')return studioJson({ok:false,error:'SAME_ORIGIN_REQUIRED'},{status:403});
  if(req.headers.get(PRICING_POLICY_HEADER)!==LIVE_PRICING_POLICY_REVISION)return studioJson({ok:false,error:'PRICING_REFRESH_REQUIRED',message:'Refresh and review this quote before confirming.'},{status:409});
  if(!studioExportConfirmationSchema.shape.projectId.safeParse(projectId).success)return studioJson({ok:false,error:'INVALID_PROJECT'},{status:400});
  try{
    const reader=req.body?.getReader();
    if(!reader)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>4096){await reader.cancel();return studioJson({ok:false,error:'BODY_TOO_LARGE'},{status:413});}chunks.push(next.value);}}finally{reader.releaseLock();}
    const parsed=studioExportConfirmationSchema.omit({projectId:true}).safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if(!parsed.success)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
    const result=await (dependencies.confirm??confirmStudioTimelineExport)({userId:access.userId,authOrigin:'studio-session',clientId:null},{...parsed.data,projectId},{enabled:true,requestOrigin:req.nextUrl.origin});
    return studioJson({ok:true,result});
  }catch(error){
    if(error instanceof SyntaxError)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
    const failure=asStudioExportAgentError(error);
    if(failure instanceof AgentApiError)return studioJson({ok:false,error:failure.code,message:failure.message},{status:error instanceof StudioExportCommandError?error.status:400});
    return studioJson({ok:false,error:'STUDIO_EXPORT_UNAVAILABLE',message:'The export acknowledgement is unavailable. Refresh the saved render status before retrying.'},{status:503});
  }
}
