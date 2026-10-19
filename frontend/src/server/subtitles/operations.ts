import {z} from 'zod';
import {requireGenerationActor,type GenerationActor} from '../agent-api/generation-actor';
import {toolAssetRefSchema} from '../../lib/toolbox/contract';
import {parseSubtitleDocument} from '../../lib/subtitles/document';
import {scribeSettingsSchema} from './scribe';
import {readOwnedSubtitleSourceFacts} from './source';
import {subtitleJobs,type SubtitleOperationRecord,type SubtitlePricing} from './jobs';
import {subtitleRepository} from './repository';
import {assertSubtitleRenderFacts} from './media';
import {estimateTimelineExportPrice} from '../timeline-exports/pricing';
export {runSubtitleOperation,reconcileSubtitleOperations} from './worker';
const defaults={assertWorker:async()=>(await import('./ecs-runner')).assertSubtitleOperationWorkerLauncherConfigured(),dispatch:async(operationId:string)=>(await import('./ecs-runner')).launchSubtitleOperationWorkerTask({operationId}),jobs:subtitleJobs,documents:subtitleRepository,readSource:readOwnedSubtitleSourceFacts,
  quoteTranscription:async(input:{durationSec:number;keyterms:string[]}):Promise<SubtitlePricing>=>{
    const {quoteSubtitleTranscription}=await import('../tools/creator-subtitle-pricing');return {...await quoteSubtitleTranscription(input)};
  },
};
export type SubtitleOperationsDependencies=typeof defaults&{dispatch:(operationId:string)=>Promise<unknown>};
function response(operation:SubtitleOperationRecord){return {operationId:operation.id,kind:operation.operation_kind,state:operation.state==='processing'||operation.state==='submitting'||operation.state==='provider-pending'?'running' as const:operation.state,jobId:operation.job_id,quote:{price:{amountCents:operation.pricing_snapshot.totalCents,currency:operation.pricing_snapshot.currency},expiresAt:new Date(operation.expires_at).toISOString()},exportEstimate:operation.export_estimate,result:operation.state==='completed'?operation.result:null,...operation.state==='failed'?{error:operation.message}: {}};}
function exportPrice(facts:Awaited<ReturnType<typeof readOwnedSubtitleSourceFacts>>['facts']){
  assertSubtitleRenderFacts(facts);
  const resolution=Math.min(facts.width,facts.height)>=2160?'4k':Math.min(facts.width,facts.height)>=1080?'1080p':'720p';
  return estimateTimelineExportPrice({durationSec:facts.durationMs/1000,resolution,fps:facts.fps,qualityPreset:'standard',freeExportsRemaining:0});
}
/** The caller supplies a trusted session/OAuth/Studio actor and a bounded durable worker launcher. */
export function createSubtitleOperationsService(actor:GenerationActor,options:{enabled:boolean;dependencies?:Partial<SubtitleOperationsDependencies>}){
  requireGenerationActor(actor);const dependencies={...defaults,...options.dependencies};
  const available=()=>{if(!options.enabled)throw new Error('SUBTITLE_TOOL_UNAVAILABLE');};
  async function prepare(input:unknown){
    available();const parsed=z.object({source:toolAssetRefSchema,language:scribeSettingsSchema.shape.language,keyterms:scribeSettingsSchema.shape.keyterms}).strict().parse(input);
    const {source,facts}=await dependencies.readSource(actor.userId,parsed.source);
    if(!facts.hasAudio)throw new Error('SUBTITLE_SOURCE_HAS_NO_AUDIO');
    const settings=scribeSettingsSchema.parse({language:parsed.language,keyterms:parsed.keyterms});
    const pricing=await dependencies.quoteTranscription({durationSec:source.durationMs/1000,keyterms:settings.keyterms});
    const estimate=source.ref.kind==='video'?exportPrice(facts):undefined;
    const operation=await dependencies.jobs.prepare(actor,'transcribe',{source,facts,settings},pricing,estimate?{amountCents:estimate.amountCents,currency:estimate.currency,requiresNewQuote:true}:undefined);
    return response(operation);
  }
  async function prepareExport(input:unknown){
    available();const parsed=z.object({documentId:z.string().min(1).max(200),revision:z.number().int().positive()}).strict().parse(input);
    const value=await dependencies.documents.read(actor.userId,parsed.documentId,parsed.revision);if(!value)throw new Error('SUBTITLE_NOT_FOUND');const document=parseSubtitleDocument(value);
    if(document.source.ref.kind!=='video')throw new Error('SUBTITLE_VISUAL_BACKGROUND_REQUIRED');if(!document.segments.length)throw new Error('SUBTITLE_DOCUMENT_EMPTY');
    const {source,facts}=await dependencies.readSource(actor.userId,document.source.ref);
    if(source.fingerprint!==document.source.fingerprint)throw new Error('SUBTITLE_SOURCE_CHANGED');
    const price=exportPrice(facts);const pricing={totalCents:price.amountCents,currency:price.currency,source:'timeline-export-paid-policy',qualityPreset:'standard'};
    return response(await dependencies.jobs.prepare(actor,'render',{source,facts,settings:{keyterms:[]},document},pricing));
  }
  async function confirm(input:unknown){
    available();const parsed=z.object({operationId:z.string().uuid(),confirmed:z.boolean()}).strict().parse(input);if(!parsed.confirmed)throw new Error('SUBTITLE_CONFIRMATION_REQUIRED');
    const current=await dependencies.jobs.read(actor,parsed.operationId);
    if(current.state!=='prepared')return response(current);
    if(!options.dependencies?.dispatch)await dependencies.assertWorker();
    const result=await dependencies.jobs.reserve(actor,parsed.operationId);
    if(result.created){
      // A launcher transport error may still have accepted work. Keep the one job for cron recovery.
      try{await dependencies.dispatch(result.operation.id);}catch{ return {...response(result.operation),dispatchPending:true}; }
    }
    return response(result.operation);
  }
  return {prepare,prepareExport,confirm,status:async(operationId:string)=>response(await dependencies.jobs.read(actor,z.string().uuid().parse(operationId)))};
}
