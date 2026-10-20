import {normalizeScribeTranscript} from '../../lib/subtitles/document';
import {subtitleJobs} from './jobs';
import {subtitleRepository} from './repository';
import {scribeAdapter} from './scribe';
import {cleanupSubtitleAudio,subtitleUserFailure} from './runtime';
const defaults={jobs:subtitleJobs,documents:subtitleRepository,provider:scribeAdapter,cleanupAudio:cleanupSubtitleAudio,
  dispatch:async(operationId:string)=>(await import('./ecs-runner')).launchSubtitleOperationWorkerTask({operationId}),
};
export type SubtitleReconciliationDependencies=typeof defaults;
/** Short polling only. Transient provider or database errors preserve the paid request and its durable id. */
export async function pollSubtitleOperation(operationId:string,overrides:Partial<SubtitleReconciliationDependencies>={}){
  const dependencies={...defaults,...overrides},current=await dependencies.jobs.readWork(operationId);
  if(!current?.provider_request_id||current.state==='completed'||current.state==='failed')return {state:'unchanged' as const};
  const result=await dependencies.provider.poll(current.provider_request_id,AbortSignal.timeout(15_000));
  if(result.state==='pending')return result;
  const operation=await dependencies.jobs.claimCompletion(current.id);if(!operation)return {state:'unchanged' as const};
  if(result.state==='failed'){await dependencies.jobs.fail(operation.id,result.message,operation.lease_token);if(operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);return result;}
  let document;
  try{document=normalizeScribeTranscript(result.data,{id:`subtitle-${operation.id}`,source:operation.prepared_audio?.source??operation.request_snapshot.source!});}
  catch(error){await dependencies.jobs.fail(operation.id,subtitleUserFailure(error),operation.lease_token);if(operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);return {state:'failed' as const};}
  const saved=await dependencies.documents.create(operation.user_id,document,operation.job_id!);
  await dependencies.jobs.complete(operation.id,{documentId:saved.id,revision:saved.revision},operation.lease_token);
  if(operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);
  return {state:'completed' as const,documentId:saved.id,revision:saved.revision};
}
/** Cron may poll suppliers or dispatch ECS tasks, but never runs a renderer inside an HTTP process. */
export async function reconcileSubtitleOperations(overrides:Partial<SubtitleReconciliationDependencies>={}){
  const dependencies={...defaults,...overrides},pending=await dependencies.jobs.pending();let polled=0,dispatched=0,errors=0;
  for(const operation of pending){
    try{if(operation.state==='submitting'){await dependencies.jobs.expireUnknown(operation.id);const terminal=await dependencies.jobs.readWork(operation.id);if(terminal?.state==='failed'&&operation.prepared_audio)await dependencies.cleanupAudio(operation.prepared_audio).catch(()=>undefined);}else if(operation.provider_request_id){await pollSubtitleOperation(operation.id,dependencies);polled++;}else{await dependencies.dispatch(operation.id);dispatched++;}}
    catch{errors++;}
  }
  return {checked:pending.length,polled,dispatched,errors};
}
