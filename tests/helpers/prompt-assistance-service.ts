/** Terminal-fixture adapter: exercise the real durable admission AND worker.
 * It preserves existing response/credit/waiver/idempotency assertions. No
 * synchronous provider fallback is added to the production service. */
import {sendPromptAssistance as admit,readPromptAssistance} from '../../frontend/src/server/prompt-assistance/service';
import {runPromptAssistanceWorkerOnce} from '../../frontend/src/server/prompt-assistance/worker';
import type {PromptExecutionDependencies} from '../../frontend/src/server/prompt-assistance/execution';
import type {PromptAssistanceRequest} from '../../frontend/src/lib/prompt-assistance/contract';
export {readPromptAssistance,recoverPromptAssistance} from '../../frontend/src/server/prompt-assistance/service';

export async function sendPromptAssistance(userId:string,input:PromptAssistanceRequest,deps:PromptExecutionDependencies={}){
  const result=await admit(userId,input,{policy:deps.policy,workersEnabled:true,executionOwner:'local'});
  if(result.state!=='pending')return result;
  await runPromptAssistanceWorkerOnce({scope:{userId,sessionId:input.sessionId,requestId:input.requestId},
    policy:deps.policy,enabled:true,executionOwner:'local',executionDependencies:deps});
  return readPromptAssistance(userId,input.sessionId,input.requestId,deps.policy);
}
