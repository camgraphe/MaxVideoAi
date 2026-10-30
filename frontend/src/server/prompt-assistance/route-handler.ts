import {NextResponse,type NextRequest} from 'next/server';
import {z,ZodError} from 'zod';
import {resolveStudioApiAccess,type StudioAccessDecision} from '@/server/studio/access';
import {readStudioAssistanceStatus,chooseStudioAssistance} from '@/server/studio/assistance-ledger';
import {studioAssistanceChoiceSchema} from '@/lib/studio/assistance-contract';
import {promptAssistanceRequestSchema} from '@/lib/prompt-assistance/contract';
import {AgentApiError} from '@/server/agent-api/errors';
import {readPromptAssistance,sendPromptAssistance,recoverPromptAssistance} from './service';
import {readPromptSession} from './sessions';
import {promptSessionScopeSchema} from '@/lib/prompt-assistance/session';

const bodySchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('message'),request:promptAssistanceRequestSchema}).strict(),
  z.object({action:z.literal('choose'),choice:studioAssistanceChoiceSchema}).strict(),
  z.object({action:z.literal('recover'),sessionId:z.string().uuid(),requestId:z.string().uuid()}).strict(),
]);
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function boundedPromptJson(req:NextRequest){
  if(!req.body)throw new SyntaxError('Missing body');
  const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export async function handlePromptAssistance(req:NextRequest,overrides:{enabled?:boolean;access?:(req:NextRequest)=>Promise<StudioAccessDecision>}={}){
  if(!(overrides.enabled??process.env.PROMPT_ASSISTANCE_ENABLED==='true'))return json({ok:false,error:'NOT_FOUND'},404);
  // Shared cookie authentication only; this endpoint never authorizes a Studio project or generation actor.
  const access=await(overrides.access??(request=>resolveStudioApiAccess(request,{enabled:true,adminOnly:false})))(req);
  if(!access.ok)return json({ok:false,error:access.error},access.status);
  if(req.method==='POST'&&(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site'))return json({ok:false,error:'SAME_ORIGIN_REQUIRED'},403);
  try{
    if(req.method==='GET'){
      const session=req.nextUrl.searchParams.get('sessionId'),request=req.nextUrl.searchParams.get('requestId');
      if(req.nextUrl.searchParams.has('scope'))return json({ok:true,result:await readPromptSession(access.userId,z.string().uuid().parse(session),promptSessionScopeSchema.parse(req.nextUrl.searchParams.get('scope')))});
      return json({ok:true,result:session||request?await readPromptAssistance(access.userId,z.string().uuid().parse(session),z.string().uuid().parse(request)):await readStudioAssistanceStatus(access.userId)});
    }
    const input=bodySchema.parse(await boundedPromptJson(req));
    return json({ok:true,result:input.action==='choose'?await chooseStudioAssistance(access.userId,input.choice):input.action==='recover'?await recoverPromptAssistance(access.userId,input.sessionId,input.requestId):await sendPromptAssistance(access.userId,input.request)});
  }catch(error){
    if(error instanceof ZodError||error instanceof SyntaxError)return json({ok:false,error:'INVALID_REQUEST'},400);
    if(error instanceof AgentApiError)return json({ok:false,error:error.code,nextAction:error.nextAction},error.code==='ACCOUNT_RESTRICTED'?403:402);
    const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'ASSISTANCE_UNAVAILABLE';
    return json({ok:false,error:code},code==='BODY_TOO_LARGE'?413:['REQUEST_NOT_FOUND','SESSION_NOT_FOUND'].includes(code)?404:['ASSISTANCE_RECOVERY_REQUIRED','ASSISTANCE_SELECTION_CHANGED','REQUEST_PENDING','REQUEST_CONFLICT','SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED'].includes(code)?409:503);
  }
}
