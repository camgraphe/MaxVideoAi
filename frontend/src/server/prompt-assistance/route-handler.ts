import {NextResponse,type NextRequest} from 'next/server';
import {z,ZodError} from 'zod';
import {resolveStudioApiAccess,type StudioAccessDecision} from '@/server/studio/access';
import {readStudioAssistanceStatus,chooseStudioAssistance} from '@/server/studio/assistance-ledger';
import {studioAssistanceChoiceSchema} from '@/lib/studio/assistance-contract';
import {promptAssistanceRequestSchema} from '@/lib/prompt-assistance/contract';
import {PROMPT_ASSISTANCE_BODY_MAX_BYTES} from '@/lib/prompt-assistance/limits';
import {AgentApiError} from '@/server/agent-api/errors';
import {readPromptAssistance,sendPromptAssistance,recoverPromptAssistance} from './service';
import {readPromptSession} from './sessions';
import {promptSessionScopeSchema,type PromptSessionSnapshot} from '@/lib/prompt-assistance/session';
import {readPendingPromptRequestPointer} from './repository';
import {schedulePromptAssistanceWorker} from './worker-host';
import {PROMPT_INLINE_ANALYSIS_HEADER} from '@/lib/prompt-assistance/client-capability';
import {publicPromptResult,publicPromptSession} from './public-response';
import {studioAnalysisPilotEnabled} from '@/server/studio/media-analysis/pilot-funding';
import {studioAnalysisPolicy} from '@/server/studio/media-analysis/policy';

const bodySchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('message'),request:promptAssistanceRequestSchema}).strict(),
  z.object({action:z.literal('choose'),choice:studioAssistanceChoiceSchema}).strict(),
  z.object({action:z.literal('recover'),sessionId:z.string().uuid(),requestId:z.string().uuid()}).strict(),
]);
export type PromptCommand=z.infer<typeof bodySchema>;
type AccessDecision=StudioAccessDecision|{ok:false;status:403|503;error:'LEGAL_CONSENT_REQUIRED'|'ASSISTANCE_UNAVAILABLE'};
export type PromptBearerTransport={
  authenticate:(request:NextRequest)=>Promise<AccessDecision>;
  projectSession?:(userId:string,snapshot:PromptSessionSnapshot)=>Promise<PromptSessionSnapshot>;
  validateQuery:(params:URLSearchParams)=>void;
  validateCommand:(input:PromptCommand)=>Promise<void>;
};
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':`Authorization, Cookie, ${PROMPT_INLINE_ANALYSIS_HEADER}`}});
export async function boundedPromptJson(req:NextRequest,maxBytes=PROMPT_ASSISTANCE_BODY_MAX_BYTES){
  if(!req.body)throw new SyntaxError('Missing body');
  const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export type PromptHandlerDependencies={enabled?:boolean;access?:(req:NextRequest)=>Promise<StudioAccessDecision>;send?:typeof sendPromptAssistance;recover?:typeof recoverPromptAssistance;schedule?:typeof schedulePromptAssistanceWorker};
export async function handlePromptAssistance(req:NextRequest,overrides:PromptHandlerDependencies={},bearer?:PromptBearerTransport){
  if(!(overrides.enabled??process.env.PROMPT_ASSISTANCE_ENABLED==='true'))return json({ok:false,error:'NOT_FOUND'},404);
  // Only the native route supplies a server-owned bearer transport. Web headers cannot select it.
  const access=await(bearer?.authenticate??overrides.access??(request=>resolveStudioApiAccess(request,{enabled:true,adminOnly:false})))(req);
  if(!access.ok)return json({ok:false,error:access.error},access.status);
  if(!bearer&&req.method==='POST'&&(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site'))return json({ok:false,error:'SAME_ORIGIN_REQUIRED'},403);
  try{
    const inlineAnalysis=req.headers.get(PROMPT_INLINE_ANALYSIS_HEADER)==='1';
    if(req.method==='GET'){
      bearer?.validateQuery(req.nextUrl.searchParams);
      const session=req.nextUrl.searchParams.get('sessionId'),request=req.nextUrl.searchParams.get('requestId');
      if(req.nextUrl.searchParams.has('scope')){
        const snapshot=publicPromptSession(await readPromptSession(access.userId,z.string().uuid().parse(session),promptSessionScopeSchema.parse(req.nextUrl.searchParams.get('scope'))),inlineAnalysis);
        return json({ok:true,result:bearer?.projectSession?await bearer.projectSession(access.userId,snapshot):snapshot});
      }
      if(session||request)return json({ok:true,result:publicPromptResult(await readPromptAssistance(access.userId,z.string().uuid().parse(session),z.string().uuid().parse(request)),inlineAnalysis)});
      const analysisPolicy=inlineAnalysis&&process.env.PROMPT_ASSISTANCE_PERCEPTION_ENABLED==='true'?studioAnalysisPolicy():null;
      const analysisSponsored=!!analysisPolicy&&studioAnalysisPilotEnabled();
      const analysisAvailable=bearer&&analysisPolicy?{visual:!!analysisPolicy.video,audio:!!analysisPolicy.audio,sponsored:analysisSponsored}:undefined;
      return json({ok:true,result:await readStudioAssistanceStatus(access.userId),pendingRequest:await readPendingPromptRequestPointer(access.userId),...(analysisSponsored?{analysisSponsored}:{}),...(analysisAvailable?{analysisAvailable}:{})});
    }
    const input=bodySchema.parse(await boundedPromptJson(req));
    await bearer?.validateCommand(input);
    if(input.action==='choose')return json({ok:true,result:await chooseStudioAssistance(access.userId,input.choice)});
    const result=input.action==='recover'?await(overrides.recover??recoverPromptAssistance)(access.userId,input.sessionId,input.requestId):await(overrides.send??sendPromptAssistance)(access.userId,input.request,bearer ? {clientSurface:'mobile'} : undefined);
    if(result.state==='pending'){
      try{(overrides.schedule??schedulePromptAssistanceWorker)({userId:access.userId,sessionId:result.sessionId,requestId:result.requestId});}
      catch{console.warn('[prompt-assistance] wakeup_deferred',{requestId:result.requestId});}
    }
    return json({ok:true,result:publicPromptResult(result,inlineAnalysis)});
  }catch(error){
    if(error instanceof ZodError||error instanceof SyntaxError)return json({ok:false,error:'INVALID_REQUEST'},400);
    if(error instanceof AgentApiError)return json({ok:false,error:error.code,nextAction:error.nextAction},error.code==='ACCOUNT_RESTRICTED'?403:402);
    const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'ASSISTANCE_UNAVAILABLE';
    const pendingRequest=code==='REQUEST_PENDING'?await readPendingPromptRequestPointer(access.userId).catch(()=>undefined):undefined;
    return json({ok:false,error:code,...(pendingRequest?{pendingRequest}:{})},code==='BODY_TOO_LARGE'?413:['REQUEST_NOT_FOUND','SESSION_NOT_FOUND'].includes(code)?404:['ASSISTANCE_RECOVERY_REQUIRED','ASSISTANCE_SELECTION_CHANGED','REQUEST_PENDING','REQUEST_CONFLICT','SESSION_EXPIRED','SESSION_FULL','SESSION_SCOPE_CHANGED'].includes(code)?409:503);
  }
}
