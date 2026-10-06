import type {NextRequest} from 'next/server';
import {z,ZodError} from 'zod';
import {resolveStudioApiAccess} from '@/server/studio/access';
import {AgentApiError} from '@/server/agent-api/errors';
import {studioAnalysisPrepareSchema,studioAnalysisConfirmSchema} from '@/lib/studio/media-analysis-contract';
import {createStudioAnalysisService} from '@/server/studio/media-analysis/service';
import {studioJson} from './studio-route-utils';

type AnalysisService={read(id:string):Promise<unknown>;prepare(request:unknown,key:string):Promise<unknown>;confirm(request:unknown):Promise<unknown>};
async function readBody(req:NextRequest){
  const reader=req.body?.getReader();if(!reader)throw new SyntaxError('INVALID_BODY');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>24_000){await reader.cancel();throw new Error('BODY_TOO_LARGE');}chunks.push(next.value);}}finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}
export async function handleStudioAnalysis(req:NextRequest,projectId:string,operation:'prepare'|'read'|'confirm',analysisId?:string,dependencies:{resolveAccess?:typeof resolveStudioApiAccess;serviceFactory?:(actor:Parameters<typeof createStudioAnalysisService>[0])=>AnalysisService}={}){
  const access=await (dependencies.resolveAccess??resolveStudioApiAccess)(req);
  if(!access.ok)return studioJson({ok:false,error:access.error},{status:access.status});
  if(!projectId||projectId!==projectId.trim()||projectId.length>128)return studioJson({ok:false,error:'INVALID_PROJECT'},{status:400});
  if(operation!=='read'&&(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site'))return studioJson({ok:false,error:'SAME_ORIGIN_REQUIRED'},{status:403});
  if(operation!=='prepare'&&!z.string().uuid().safeParse(analysisId).success)return studioJson({ok:false,error:'INVALID_ANALYSIS'},{status:400});
  try{
    const actor={authMethod:'studio-session' as const,userId:access.userId,projectId,clientId:null};
    const service=(dependencies.serviceFactory??createStudioAnalysisService)(actor);
    if(operation==='read')return studioJson({ok:true,result:await service.read(analysisId!)});
    const raw=await readBody(req);
    if(operation==='prepare'){
      const input=z.object({request:studioAnalysisPrepareSchema,requestKey:z.string().uuid()}).strict().parse(raw);
      return studioJson({ok:true,result:await service.prepare(input.request,input.requestKey)});
    }
    const input=studioAnalysisConfirmSchema.parse(raw);
    if(input.analysisId!==analysisId)return studioJson({ok:false,error:'INVALID_ANALYSIS'},{status:400});
    return studioJson({ok:true,result:await service.confirm(input)});
  }catch(error){
    if(error instanceof SyntaxError||error instanceof ZodError)return studioJson({ok:false,error:'INVALID_REQUEST'},{status:400});
    if(error instanceof Error&&error.message==='BODY_TOO_LARGE')return studioJson({ok:false,error:'BODY_TOO_LARGE'},{status:413});
    if(error instanceof AgentApiError)return studioJson({ok:false,error:error.code,message:error.message},{status:error.code==='SPENDING_LIMIT_EXCEEDED'?402:error.code==='QUOTE_EXPIRED'?409:error.code==='ENGINE_UNAVAILABLE'?503:400});
    return studioJson({ok:false,error:'STUDIO_ANALYSIS_UNAVAILABLE',message:'This analysis is temporarily unavailable. Recover its saved status before retrying.'},{status:503});
  }
}
