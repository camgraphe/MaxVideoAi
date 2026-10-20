import {cleanupSubtitleAudio,subtitleUserFailure} from './runtime';
export {pollSubtitleOperation,reconcileSubtitleOperations} from './reconciliation';
import {subtitleJobs,type SubtitleOperationRecord} from './jobs';
import {prepareSubtitleSequenceAudio} from './sequence-worker';
import {prepareScribeAudio} from './source';
import {scribeAdapter,SubtitleProviderRejected} from './scribe';
import {renderAndPublishSubtitles} from './publish';
const defaults={jobs:subtitleJobs,provider:scribeAdapter,prepareMix:prepareSubtitleSequenceAudio,prepareAudio:prepareScribeAudio,render:renderAndPublishSubtitles,
  cleanupAudio:cleanupSubtitleAudio,
};
export type SubtitleWorkerDependencies=typeof defaults;
/** A process may die at any await. Claims precede work; submitting is an explicit unknown-acceptance boundary. */
export async function runSubtitleOperation(operationId:string,overrides:Partial<SubtitleWorkerDependencies>={}){
  const dependencies={...defaults,...overrides},operation=await dependencies.jobs.claim(operationId);
  if(!operation)return {state:'unchanged' as const};
  const signal=AbortSignal.timeout(35*60_000);
  if(operation.operation_kind==='render'){
    let result:Record<string,unknown>;
    try{result=await dependencies.render(operation,signal);}
    catch(error){await dependencies.jobs.fail(operation.id,subtitleUserFailure(error),operation.lease_token);return {state:'failed' as const};}
    // A database outage after publication must remain recoverable; it must not refund a delivered artifact.
    await dependencies.jobs.complete(operation.id,result,operation.lease_token);return {state:'completed' as const};
  }
  let audio:NonNullable<SubtitleOperationRecord['prepared_audio']>;
  try{if(operation.request_snapshot.sequence)audio=await dependencies.prepareMix(operation.user_id,operation.request_snapshot.sequence,signal);else if(operation.request_snapshot.source)audio=await dependencies.prepareAudio(operation.user_id,operation.request_snapshot.source,signal);else throw new Error('SUBTITLE_SOURCE_CHANGED');}
  catch(error){await dependencies.jobs.fail(operation.id,subtitleUserFailure(error),operation.lease_token);return {state:'failed' as const};}
  try{await dependencies.jobs.submitting(operation.id,audio,operation.lease_token);}
  catch(error){await dependencies.cleanupAudio(audio).catch(()=>undefined);throw error;}
  let requestId:string;
  try{requestId=(await dependencies.provider.submit({audioUrl:audio.audioUrl,...operation.request_snapshot.settings})).requestId;}
  catch(error){
    if(error instanceof SubtitleProviderRejected){await dependencies.jobs.fail(operation.id,subtitleUserFailure(error),operation.lease_token);await dependencies.cleanupAudio(audio).catch(()=>undefined);return {state:'failed' as const};}
    // No supplier id is known: retrying could buy a second transcription. Keep its charge and audio for reconciliation.
    return {state:'acceptance-unknown' as const};
  }
  await dependencies.jobs.submitted(operation.id,requestId,operation.lease_token);
  return {state:'provider-pending' as const};
}
