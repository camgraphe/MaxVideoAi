import {NextResponse,type NextRequest} from 'next/server';
import {z,ZodError} from 'zod';
import {resolveStudioApiAccess,type StudioAccessDecision} from '@/server/studio/access';
import {AgentApiError} from '@/server/agent-api/errors';
import {promptAnalysisActionSchema} from '@/lib/prompt-assistance/analysis-contract';
import {createComposerAnalysisService} from '@/server/studio/media-analysis/service';
import {scheduleStudioWorker} from '@/server/studio/worker-host';
import {composerScope} from './repository';
import {preparePromptReferenceAnalysis} from './reference-analysis';
import {boundedPromptJson} from './route-handler';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
export async function handlePromptAnalysis(req:NextRequest,deps:{enabled?:boolean;access?:(req:NextRequest)=>Promise<StudioAccessDecision>}={}) {
  if(!(deps.enabled??process.env.PROMPT_ASSISTANCE_ENABLED==='true'))return json({ok:false,error:'NOT_FOUND'},404);
  const access=await(deps.access??(request=>resolveStudioApiAccess(request,{enabled:true,adminOnly:false})))(req);
  if(!access.ok)return json({ok:false,error:access.error},access.status);
  if(req.method==='POST'&&(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site'))return json({ok:false,error:'SAME_ORIGIN_REQUIRED'},403);
  try {
    if(req.method==='GET'){
      const session=z.string().uuid().parse(req.nextUrl.searchParams.get('sessionId')),id=z.string().uuid().parse(req.nextUrl.searchParams.get('analysisId'));
      return json({ok:true,result:{status:await createComposerAnalysisService(access.userId,session).read(id)}});
    }
    const input=promptAnalysisActionSchema.parse(await boundedPromptJson(req));
    if(input.action==='prepare')return json({ok:true,result:await preparePromptReferenceAnalysis(access.userId,input)});
    if(process.env.PROMPT_ASSISTANCE_PERCEPTION_ENABLED!=='true')throw new Error('ANALYSIS_UNAVAILABLE');
    const status=await createComposerAnalysisService(access.userId,input.sessionId).confirm(input.confirmation);
    if(status.state==='queued')scheduleStudioWorker('analysis',{...composerScope(access.userId,input.sessionId),requestId:status.quote.analysisId});
    return json({ok:true,result:{status}});
  }catch(error){
    if(error instanceof ZodError||error instanceof SyntaxError)return json({ok:false,error:'INVALID_REQUEST'},400);
    if(error instanceof AgentApiError)return json({ok:false,error:error.code,message:error.message},error.code==='REFERENCE_INVALID'?404:409);
    const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'ANALYSIS_UNAVAILABLE';
    return json({ok:false,error:code},code==='BODY_TOO_LARGE'?413:503);
  }
}
