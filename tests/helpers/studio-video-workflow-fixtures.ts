import {listFalEngines} from '../../frontend/src/config/falEngines';
import {listPublicAgentGenerationEngines,type AgentPublicGenerationEngine} from '../../frontend/src/server/agent-api/model-catalog';
import {projectAgentModelModeDetails} from '../../frontend/src/server/agent-api/model-details';
import type {CanonicalGenerationRequest} from '../../frontend/src/server/agent-api/generation-types';
import type {ResolvedReference} from '../../frontend/src/server/agent-api/reference-types';
import type {StudioMediaIntent} from '../../frontend/lib/studio/conversation-media-contract';
import {isLumaRay2EngineId} from '../../frontend/src/lib/luma-ray2';

export const workflowActor={authMethod:'studio-session' as const,userId:'workflow-owner',projectId:'workflow-project',clientId:null};
export const workflowAssetIds={image:'ma_'+'1'.repeat(32),video:'ma_'+'2'.repeat(32),audio:'ma_'+'3'.repeat(32)};
export const workflowInput={requestId:'123e4567-e89b-42d3-a456-426614174000',message:'Use these exact owned media.',references:[workflowAssetIds.image],attachments:[{type:'asset' as const,kind:'video' as const,assetId:workflowAssetIds.video},{type:'asset' as const,kind:'audio' as const,assetId:workflowAssetIds.audio}]};
export async function workflowCatalog(){const entries=listFalEngines();return(await listPublicAgentGenerationEngines({listEngines:async()=>entries.map(e=>e.engine),surfaceByEngineId:id=>entries.find(e=>e.id===id)?.category==='image'?'image':'video',isEngineExecutable:()=>true,isModeExecutable:()=>true})).filter(e=>e.surface==='video');}
export function workflowReference(kind:ResolvedReference['mediaKind'],role:ResolvedReference['role'],slot?:number):ResolvedReference {
  const extension=kind==='image'?'png':kind==='video'?'mp4':'wav';
  return {assetId:workflowAssetIds[kind],role,mediaKind:kind,...(slot===undefined?{}:{slot}),storageUrl:`https://cdn.maxvideoai.com/workflow.${extension}`,mimeType:kind==='image'?'image/png':kind==='video'?'video/mp4':'audio/wav',width:kind==='audio'?null:1920,height:kind==='audio'?null:1080,durationSec:kind==='image'?null:6,sizeBytes:4096,originalName:`workflow.${extension}`};
}
export function workflowAction(candidate:AgentPublicGenerationEngine,mode:CanonicalGenerationRequest['mode']):Extract<StudioMediaIntent,{action:'video.prepare'}> {
  const details=projectAgentModelModeDetails(candidate,mode);
  const pairs: [ResolvedReference['mediaKind'],ResolvedReference['role']][]=mode==='t2v'?[]:mode==='fl2v'?[['image','first_frame'],['image','last_frame']]:mode==='ref2v'?[['image','reference']]:mode==='r2v'?[['video','reference']]:mode==='a2v'?[['audio','source']]:['v2v','extend','retake','reframe'].includes(mode)?[['video','source']]:[['image','first_frame']];
  const settings=details.settings.filter(s=>s.default!==null&&s.type!=='multi_prompt'&&!['durationSec','resolution','aspectRatio','documentUrl','webpageUrl'].includes(s.key)).map(s=>({name:s.key,value:s.default}));
  const derived=mode==='a2v'||mode==='reframe'||mode==='v2v'&&isLumaRay2EngineId(candidate.engine.id);
  settings.push({name:'durationSec',value:derived?6:details.duration?.options?.[0]??details.duration?.range?.min??5});
  settings.push({name:'resolution',value:mode==='v2v'&&isLumaRay2EngineId(candidate.engine.id)?candidate.engine.resolutions.find(r=>r!=='auto')!:details.resolutions[0]});
  if(details.aspectRatios.length)settings.push({name:'aspectRatio',value:details.aspectRatios.includes('16:9')?'16:9':details.aspectRatios[0]});
  return {action:'video.prepare',reply:'Review this exact media quote.',prompt:'Continue the cinematic action with restrained motion.',aspectRatio:'16:9',source:null,modelId:candidate.engine.id,mode:mode as never,settings,outputCount:1,references:pairs.map(([kind,role])=>({ref:{type:'asset',assetId:workflowAssetIds[kind],kind},role,slot:null}))};
}
export function workflowResolved(request:CanonicalGenerationRequest,action:Extract<StudioMediaIntent,{action:'video.prepare'}>):ResolvedReference[]{return request.references.map(reference=>{
  const selection=action.references!.find(r=>r.ref.type==='asset'&&reference.kind==='asset'&&r.ref.assetId===reference.assetId&&r.role===reference.role)!;
  return workflowReference(selection.ref.kind,reference.role,reference.slot);
});}
