import {normalizeScribeTranscript} from '../../lib/subtitles/document';
import {subtitleJobs,type SubtitleOperationRecord} from './jobs';
import {subtitleRepository} from './repository';
import {prepareScribeAudio} from './source';
import {scribeAdapter,SubtitleProviderRejected} from './scribe';
import {renderAndPublishSubtitles} from './publish';
const defaults={jobs:subtitleJobs,documents:subtitleRepository,provider:scribeAdapter,prepareAudio:prepareScribeAudio,render:renderAndPublishSubtitles,
  cleanupAudio:async(audio:NonNullable<SubtitleOperationRecord['prepared_audio']>)=>{await (await import('@/server/storage')).deleteStorageObjectByUrl(audio.storageUrl);},
  dispatch:async(operationId:string)=>(await import('./ecs-runner')).launchSubtitleOperationWorkerTask({operationId}),
};
export type SubtitleWorkerDependencies=typeof defaults;
const userFailure=(error:unknown)=>error instanceof Error&&/^SUBTITLE_[A-Z_]+$/.test(error.message)?error.message:'Subtitle processing failed.';
/** A process may die at any await. Claims precede work; submitting is an explicit unknown-acceptance boundary. */
export async function runSubtitleOperation(operationId:string,overrides:Partial<SubtitleWorkerDependencies>={}){
  const dependencies={...defaults,...overrides},operation=await dependencies.jobs.claim(operationId);
  if(!operation)return {state:'unchanged' as const};
  const signal=AbortSignal.timeout(35*60_000);
  if(operation.operation_kind==='render'){
    let result:Record<string,unknown>;
    try{result=await dependencies.render(operation,signal);}
    catch(error){await dependencies.jobs.fail(operation.id,userFailure(error),operation.lease_token);return {state:'failed' as const};}
    // A database outage after publication must remain recoverable; it must not refund a delivered artifact.
    await dependencies.jobs.complete(operation.id,result,operation.lease_token);return {state:'completed' as const};
  }
  let audio:NonNullable<SubtitleOperationRecord['prepared_audio']>;
  try{audio=await dependencies.prepareAudio(operation.user_id,operation.request_snapshot.source,signal);}
  catch(error){await dependencies.jobs.fail(operation.id,userFailure(error),operation.lease_token);return {state:'failed' as const};}
  try{await dependencies.jobs.submitting(operation.id,audio,operation.lease_token);}
  catch(error){await dependencies.cleanupAudio(audio).catch(()=>undefined);throw error;}
  let requestId:string;
  try{requestId=(await dependencies.provider.submit({audioUrl:audio.audioUrl,...operation.request_snapshot.settings})).requestId;}
  catch(error){
    if(error instanceof SubtitleProviderRejected){await dependencies.jobs.fail(operation.id,userFailure(error),operation.lease_token);await dependencies.cleanupAudio(audio).catch(()=>undefined);return {state:'failed' as const};}
    // No supplier id is known: retrying could buy a second transcription. Keep its charge and audio for reconciliation.
    return {state:'acceptance-unknown' as const};
  }
  await dependencies.jobs.submitted(operation.id,requestId,operation.lease_token);
  return {state:'provider-pending' as const};
}
/** Short polling only. Transient provider or database errors preserve the paid request and its durable id. */
export async function pollSubtitleOperation(operationId:string,overrides:Partial<SubtitleWorkerDependencies>={}){
  const dependencies={...defaults,...overrides},current=await dependencies.jobs.readWork(operationId);
  if(!current?.provider_request_id||current.state==='completed'||current.state==='failed')return {state:'unchanged' as const};
  const result=await dependencies.provider.poll(current.provider_request_id,AbortSignal.timeout(15_000));
  if(result.state==='pending')return result;
  const operation=await dependencies.jobs.claimCompletion(current.id);if(!operation)return {state:'unchanged' as const};
  if(result.state==='failed'){await dependencies.jobs.fail(operation.id,result.message,operation.lease_token);if(operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);return result;}
  let document;
  try{document=normalizeScribeTranscript(result.data,{id:`subtitle-${operation.id}`,source:operation.request_snapshot.source});}
  catch(error){await dependencies.jobs.fail(operation.id,userFailure(error),operation.lease_token);if(operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);return {state:'failed' as const};}
  const saved=await dependencies.documents.create(operation.user_id,document,operation.job_id!);
  await dependencies.jobs.complete(operation.id,{documentId:saved.id,revision:saved.revision},operation.lease_token);
  if(operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);
  return {state:'completed' as const,documentId:saved.id,revision:saved.revision};
}
/** Cron may poll suppliers or dispatch ECS tasks, but never runs a renderer inside an HTTP process. */
export async function reconcileSubtitleOperations(overrides:Partial<SubtitleWorkerDependencies>={}){
  const dependencies={...defaults,...overrides},pending=await dependencies.jobs.pending();let polled=0,dispatched=0,errors=0;
  for(const operation of pending){
    try{if(operation.state==='submitting'){await dependencies.jobs.expireUnknown(operation.id);const terminal=await dependencies.jobs.readWork(operation.id);if(terminal?.state==='failed'&&operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);}else if(operation.provider_request_id){await pollSubtitleOperation(operation.id,dependencies);polled++;}else{await dependencies.dispatch(operation.id);dispatched++;}}
    catch{errors++;}
  }
  return {checked:pending.length,polled,dispatched,errors};
}
