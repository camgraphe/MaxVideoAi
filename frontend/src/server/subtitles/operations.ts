import {z} from 'zod';
import {requireGenerationActor,type GenerationActor} from '../agent-api/generation-actor';
import {toolAssetRefSchema} from '../../lib/toolbox/contract';
import {parseSubtitleDocument} from '../../lib/subtitles/document';
import {scribeSettingsSchema} from './scribe';
import {readOwnedSubtitleSequence} from './sequence-source';
import {workspaceProjectDimensions} from '@/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-project-settings';
import {readOwnedSubtitleSourceFacts} from './source';
import {subtitleJobs,type SubtitleOperationRecord,type SubtitlePricing} from './jobs';
import {subtitleRepository} from './repository';
import {subtitleExportPrice,subtitleExportPricing,subtitleMixPricing} from './pricing';
const defaults={readSequence:readOwnedSubtitleSequence,assertWorker:async()=>(await import('./ecs-runner')).assertSubtitleOperationWorkerLauncherConfigured(),dispatch:async(operationId:string)=>(await import('./ecs-runner')).launchSubtitleOperationWorkerTask({operationId}),jobs:subtitleJobs,documents:subtitleRepository,readSource:readOwnedSubtitleSourceFacts,
  quoteTranscription:async(input:{durationSec:number;keyterms:string[]}):Promise<SubtitlePricing>=>{
    const {quoteSubtitleTranscription}=await import('../tools/creator-subtitle-pricing');return {...await quoteSubtitleTranscription(input)};
  },
};
export type SubtitleOperationsDependencies=typeof defaults&{dispatch:(operationId:string)=>Promise<unknown>};
function response(operation:SubtitleOperationRecord){
  const request=operation.request_snapshot;
  return {...request.sequence?{sourceSummary:{kind:'sequence' as const,name:request.sequence.manifest.sequenceName,revision:request.sequence.revision}}:{},operationId:operation.id,kind:operation.operation_kind,state:operation.state==='processing'||operation.state==='submitting'||operation.state==='provider-pending'?'running' as const:operation.state,jobId:operation.job_id,...operation.state==='submitting'?{needsAttention:true,retryable:false}: {},quote:{price:{amountCents:operation.pricing_snapshot.totalCents,currency:operation.pricing_snapshot.currency},expiresAt:new Date(operation.expires_at).toISOString(),...operation.pricing_snapshot.breakdown?{breakdown:operation.pricing_snapshot.breakdown}:{}},exportEstimate:operation.export_estimate,result:operation.state==='completed'?operation.result:null,...operation.state==='failed'?{error:operation.message}: {},
    ...(operation.state==='prepared'?{subtitle:{source:request.source?.ref??null,settings:request.settings,
      ...(request.document?{document:{id:request.document.id,revision:request.document.revision}}:{}),
      ...(request.sequence?{sequence:{projectId:request.sequence.projectId,sequenceId:request.sequence.sequenceId,expectedRevision:request.sequence.revision}}:{}),
    }}:{})};
}
/** The caller supplies a trusted session/OAuth/Studio actor and a bounded durable worker launcher. */
export function createSubtitleOperationsService(actor:GenerationActor,options:{enabled:boolean;dependencies?:Partial<SubtitleOperationsDependencies>}){
  requireGenerationActor(actor);const dependencies={...defaults,...options.dependencies};
  const available=()=>{if(!options.enabled)throw new Error('SUBTITLE_TOOL_UNAVAILABLE');};
  async function prepare(input:unknown){
    available();const parsed=z.object({source:toolAssetRefSchema,language:scribeSettingsSchema.shape.language,keyterms:scribeSettingsSchema.shape.keyterms}).strict().parse(input);
    const {source,facts,originalIdentity}=await dependencies.readSource(actor.userId,parsed.source);
    if(!facts.hasAudio)throw new Error('SUBTITLE_SOURCE_HAS_NO_AUDIO');
    const settings=scribeSettingsSchema.parse({language:parsed.language,keyterms:parsed.keyterms});
    const pricing=await dependencies.quoteTranscription({durationSec:source.durationMs/1000,keyterms:settings.keyterms});
    const estimate=source.ref.kind==='video'?subtitleExportPrice(facts):undefined;
    const operation=await dependencies.jobs.prepare(actor,'transcribe',{source,facts,originalIdentity,settings},pricing,estimate?{...estimate,requiresNewQuote:false}:undefined);
    return response(operation);
  }
  async function prepareStudioSubtitles(input:unknown){
    available();const parsed=z.object({projectId:z.string().min(1).max(200),sequenceId:z.string().min(1).max(200),expectedRevision:z.number().int().nonnegative(),language:scribeSettingsSchema.shape.language,keyterms:scribeSettingsSchema.shape.keyterms}).strict().parse(input);
    if(actor.authMethod==='studio-session'&&actor.projectId!==parsed.projectId)throw new Error('SUBTITLE_SEQUENCE_CHANGED');
    const sequence=await dependencies.readSequence(actor.userId,parsed),settings=scribeSettingsSchema.parse({language:parsed.language,keyterms:parsed.keyterms});
    const projectSettings=sequence.manifest.projectSettings!;const dimensions=workspaceProjectDimensions(projectSettings);
    const facts={durationMs:Math.round(sequence.manifest.durationSec*1000),width:dimensions.width,height:dimensions.height,fps:projectSettings.fps,hasAudio:true};
    const transcription=await dependencies.quoteTranscription({durationSec:facts.durationMs/1000,keyterms:settings.keyterms});
    const pricing=subtitleMixPricing(transcription,facts);
    return response(await dependencies.jobs.prepare(actor,'mix-transcribe',{source:null,sequence,facts,settings},pricing));
  }
  async function prepareExport(input:unknown){
    available();const parsed=z.object({documentId:z.string().min(1).max(200),revision:z.number().int().positive()}).strict().parse(input);
    const value=await dependencies.documents.read(actor.userId,parsed.documentId,parsed.revision);if(!value)throw new Error('SUBTITLE_NOT_FOUND');const document=parseSubtitleDocument(value);
    if(document.source.ref.kind!=='video')throw new Error('SUBTITLE_VISUAL_BACKGROUND_REQUIRED');if(!document.segments.length)throw new Error('SUBTITLE_DOCUMENT_EMPTY');
    const {source,facts,originalIdentity}=await dependencies.readSource(actor.userId,document.source.ref);
    if(source.fingerprint!==document.source.fingerprint)throw new Error('SUBTITLE_SOURCE_CHANGED');
    const pricing=subtitleExportPricing(facts);
    return response(await dependencies.jobs.prepare(actor,'render',{source,facts,originalIdentity,settings:{keyterms:[]},document},pricing));
  }
  async function confirm(input:unknown){
    available();const parsed=z.object({operationId:z.string().uuid(),confirmed:z.boolean()}).strict().parse(input);if(!parsed.confirmed)throw new Error('SUBTITLE_CONFIRMATION_REQUIRED');
    const current=await dependencies.jobs.read(actor,parsed.operationId);
    if(current.state!=='prepared')return response(current);
    if(!options.dependencies?.dispatch)await dependencies.assertWorker();
    // Sequence identity is locked/rechecked by reserve. Original media bytes are inspected outside locks.
    if(current.request_snapshot.source){
      const latest=await dependencies.readSource(actor.userId,current.request_snapshot.source.ref);
      if(latest.source.fingerprint!==current.request_snapshot.source.fingerprint||latest.originalIdentity.id!==current.request_snapshot.originalIdentity?.id||latest.originalIdentity.url!==current.request_snapshot.originalIdentity?.url)throw new Error('SUBTITLE_SOURCE_CHANGED');
    }
    const result=await dependencies.jobs.reserve(actor,parsed.operationId);
    if(result.created){
      // A launcher transport error may still have accepted work. Keep the one job for cron recovery.
      try{await dependencies.dispatch(result.operation.id);}catch{ return {...response(result.operation),dispatchPending:true}; }
    }
    return response(result.operation);
  }
  return {prepare,prepareStudioSubtitles,prepareExport,confirm,status:async(operationId:string)=>response(await dependencies.jobs.read(actor,z.string().uuid().parse(operationId)))};
}
