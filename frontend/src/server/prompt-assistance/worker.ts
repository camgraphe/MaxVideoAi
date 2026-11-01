import type {StudioAssistancePolicy} from '@/server/studio/assistance-policy';
import {studioAssistancePolicy} from '@/server/studio/assistance-policy';
import type {PromptRequestScope} from './repository';
import {claimPromptWork,renewPromptWorkLease} from './worker-repository';
import {executePromptAssistance,type PromptExecutionDependencies} from './execution';
import {finishRecorded} from './service';
import {closeUnansweredPromptRequest} from './unanswered';
import {promptWorkersEnabled,promptExecutionOwner,PROMPT_WORKER_HEARTBEAT_MS} from './worker-policy';

export async function runPromptAssistanceWorkerOnce(options:{scope?:PromptRequestScope;policy?:StudioAssistancePolicy;enabled?:boolean;executionOwner?:string;executionDependencies?:PromptExecutionDependencies}={}){
  if(!(options.enabled??promptWorkersEnabled()))return false;
  const work=await claimPromptWork(options.scope,options.executionOwner??promptExecutionOwner());
  if(!work)return false;
  const row=work.row,policy=options.policy??studioAssistancePolicy();
  if(work.kind==='closed')return true;
  if(work.kind==='settle'){await finishRecorded(row,policy);return true;}
  if(work.kind==='close'){await closeUnansweredPromptRequest(row.user_id,row.session_id,row.request_id);return true;}
  const scope={userId:row.user_id,sessionId:row.session_id,requestId:row.request_id};let renewing=false;
  const heartbeat=setInterval(()=>{
    if(renewing)return;renewing=true;
    void renewPromptWorkLease(scope,row.lease_id).catch(()=>{
      console.warn('[prompt-assistance] heartbeat_deferred',{requestId:row.request_id});
    }).finally(()=>{renewing=false;});
  },PROMPT_WORKER_HEARTBEAT_MS);heartbeat.unref();
  try{await executePromptAssistance(row,{...options.executionDependencies,policy});}
  finally{clearInterval(heartbeat);}
  return true;
}
