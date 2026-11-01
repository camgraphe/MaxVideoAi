import {after} from 'next/server';
import type {PromptRequestScope} from './repository';
import {runPromptAssistanceWorkerOnce} from './worker';

/** A best-effort wakeup, not the durable queue. The saved row remains cron-visible. */
export function schedulePromptAssistanceWorker(scope:PromptRequestScope){
  try{after(async()=>{
    try{await runPromptAssistanceWorkerOnce({scope});}
    catch{console.warn('[prompt-assistance] worker_deferred',{requestId:scope.requestId});}
  });}catch{console.warn('[prompt-assistance] wakeup_deferred',{requestId:scope.requestId});}
}
