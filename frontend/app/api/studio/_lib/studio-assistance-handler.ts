import type {NextRequest} from 'next/server';
import {ZodError} from 'zod';
import {resolveStudioApiAccess,type StudioAccessDecision} from '@/server/studio/access';
import {readStudioAssistanceStatus,chooseStudioAssistance} from '@/server/studio/assistance-ledger';
import {studioAssistanceChoiceSchema} from '@/lib/studio/assistance-contract';
import {AgentApiError} from '@/server/agent-api/errors';
import {studioJson} from './studio-route-utils';

async function boundedChoice(req:NextRequest){
  if(!req.body)throw new SyntaxError('Missing body');
  const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  return studioAssistanceChoiceSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
export async function handleStudioAssistance(req:NextRequest,action:'read'|'choose',overrides:{resolveAccess?:(req:NextRequest)=>Promise<StudioAccessDecision>;read?:typeof readStudioAssistanceStatus;choose?:typeof chooseStudioAssistance}={}){
  const access=await(overrides.resolveAccess??resolveStudioApiAccess)(req);
  if(!access.ok)return studioJson({ok:false,error:access.error},{status:access.status});
  if(action==='choose'&&(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site'))return studioJson({ok:false,error:'SAME_ORIGIN_REQUIRED'},{status:403});
  try{
    const result=action==='read'?await(overrides.read??readStudioAssistanceStatus)(access.userId):await(overrides.choose??chooseStudioAssistance)(access.userId,await boundedChoice(req));
    return studioJson({ok:true,result});
  }catch(error){
    if(error instanceof ZodError||error instanceof SyntaxError)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
    if(error instanceof Error&&error.message==='BODY_TOO_LARGE')return studioJson({ok:false,error:'BODY_TOO_LARGE'},{status:413});
    if(error instanceof AgentApiError)return studioJson({ok:false,error:error.code,message:error.message,retryable:error.retryable,nextAction:error.nextAction},{status:error.code==='ENGINE_UNAVAILABLE'?503:error.code==='CONFIRMATION_REQUIRED'||error.code==='PARAMETER_INVALID'?409:402});
    return studioJson({ok:false,error:'STUDIO_ASSISTANCE_UNAVAILABLE',message:'Studio usage could not be loaded. No new assistance call was authorized.'},{status:503});
  }
}
