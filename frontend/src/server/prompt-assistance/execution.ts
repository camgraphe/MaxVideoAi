import {assistanceNextActionSchema} from '@/lib/studio/assistance-contract';
import {query,withDbTransaction} from '@/lib/db';
import {studioAssistancePolicy,type StudioAssistancePolicy} from '@/server/studio/assistance-policy';
import {reserveStudioAssistanceCall,markStudioAssistanceUnknown} from '@/server/studio/assistance-ledger';
import {buildPromptAssistanceContext} from './context';
import {buildAssistantReviewContext} from '../assistant-review/context';
import {composerScope,readPromptHistory,readPromptRequest,promptScopeValues,type PromptRequestRow} from './repository';
import {countPromptTokens,createPromptResponse,promptResponseParams,promptProviderTimeout,promptProviderFailure} from './provider';
import {preparePromptPerception} from './perception';
import {closeUnansweredPromptRequest} from './unanswered';
import {AgentApiError} from '@/server/agent-api/errors';
import {PROMPT_REPLY_FORMAT} from './reply-format';

import {finishRecorded,projectPromptResult} from './service';
export type PromptExecutionDependencies={policy?:StudioAssistancePolicy;buildContext?:typeof buildPromptAssistanceContext;count?:typeof countPromptTokens;create?:typeof createPromptResponse;perception?:typeof preparePromptPerception};
/** Claimed preparation only. All external work runs after the claim transaction. */
export async function executePromptAssistance(row:PromptRequestRow,deps:PromptExecutionDependencies={}){
  const startedAt=Date.now(),deadline=new Date(row.execution_deadline_at!).getTime();
  const input=row.input_json,userId=row.user_id,policy=deps.policy??studioAssistancePolicy();
  let dispatched=false,responseReceived=false;
  let reviewContext:Record<string,unknown>|undefined;
  try {
    if(!policy.enabled)throw new Error('ASSISTANCE_DISABLED');
    promptProviderTimeout(deadline);
    const context=await withinDeadline(()=>(deps.buildContext??buildPromptAssistanceContext)(userId,input),deadline);
    promptProviderTimeout(deadline);
    const perceived=await withinDeadline(()=>(deps.perception??preparePromptPerception)(userId,input,row.model,context),deadline);
    const params=promptResponseParams(row,perceived.context,await readPromptHistory(row),perceived.content);
    reviewContext={...perceived.context,replyFormat:PROMPT_REPLY_FORMAT,reviewInput:buildAssistantReviewContext(params)};
    const inputTokens=await withinDeadline(()=>(deps.count??countPromptTokens)(params,promptProviderTimeout(deadline,15_000)),deadline,15_000);
    if(!Number.isSafeInteger(inputTokens)||inputTokens<1||inputTokens>32000)throw new Error('CONTEXT_TOO_LARGE');
    const call=await withDbTransaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${userId}`]);
      const current=await readPromptRequest(userId,input.sessionId,input.requestId,tx);
      const live=(await tx.query<{live:boolean}>('SELECT lease_expires_at>clock_timestamp() AND execution_deadline_at>clock_timestamp() live FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 AND request_id=$3 FOR UPDATE',promptScopeValues(row)))[0]?.live;
      if(current.state!=='preparing'||current.call_id||current.lease_id!==row.lease_id||!live)throw new Error('REQUEST_INTERRUPTED');
      promptProviderTimeout(deadline);
      const reserved=await reserveStudioAssistanceCall({...composerScope(userId,input.sessionId),requestId:input.requestId,leaseId:row.lease_id,index:0,inputTokens,outputTokens:params.max_output_tokens??2200},policy,tx);
      await tx.query("UPDATE prompt_assistance_requests SET state='calling',call_id=$4,context_json=$5::jsonb,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3",[...promptScopeValues(row),reserved.id,JSON.stringify(reviewContext)]);
      promptProviderTimeout(deadline); // Exhaustion here rolls back the call and its hold.
      return reserved;
    });
    row.call_id=call.id;dispatched=true;
    const response=await (deps.create??createPromptResponse)(params,promptProviderTimeout(deadline));
    responseReceived=true;
    // Persist supplier evidence before settlement; replay can finish without another provider call.
    await query("UPDATE prompt_assistance_requests SET response_json=$4::jsonb,state=CASE WHEN state='failed' THEN state ELSE 'reported' END,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND call_id=$5 AND response_json IS NULL",[...promptScopeValues(row),JSON.stringify(response),call.id]);
    return await finishRecorded(await readPromptRequest(userId,input.sessionId,input.requestId),policy);
  } catch(error) {
    if(dispatched&&row.call_id)await markStudioAssistanceUnknown(row.call_id,userId);
    const known=error instanceof AgentApiError?error.code:error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'ASSISTANCE_UNAVAILABLE';
    const providerFailure=dispatched&&!responseReceived?promptProviderFailure(error,Date.now()-startedAt):undefined;
    if(providerFailure)console.warn('[prompt-assistance] provider_failed',{requestId:input.requestId,callId:row.call_id,model:row.model,...providerFailure});
    const nextAction=assistanceNextActionSchema.safeParse(error instanceof AgentApiError?error.nextAction:null);
    await query("UPDATE prompt_assistance_requests SET state=$4,error=$5,context_json=COALESCE(context_json,'{}'::jsonb)||$6::jsonb,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND state NOT IN ('complete','failed') AND (($7::uuid IS NULL AND call_id IS NULL AND lease_id=$8) OR ($7::uuid IS NOT NULL AND call_id=$7))",[...promptScopeValues(row),dispatched?'unknown':'failed',known,JSON.stringify({...(providerFailure?{providerFailure}:{}),...(!dispatched&&reviewContext?{...reviewContext,reviewInput:{...(reviewContext.reviewInput as object),capturePoint:'prepared_not_dispatched'}}:{}),...(!dispatched&&nextAction.success?{failureAction:nextAction.data}:{})}),dispatched?row.call_id:null,row.lease_id]);
    if(dispatched&&!responseReceived){
      // This invocation has stopped awaiting the provider. Shorten only its own
      // unanswered lease; saved evidence and another lease always win.
      await query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND lease_id=$4 AND call_id=$5 AND state='unknown' AND response_json IS NULL",[...promptScopeValues(row),row.lease_id,row.call_id]);
      await closeUnansweredPromptRequest(userId,input.sessionId,input.requestId);
    }
    return projectPromptResult(await readPromptRequest(userId,input.sessionId,input.requestId),policy);
  }
}

/** Expired preparation cannot continue into token counting/reservation/create. */
async function withinDeadline<T>(work:()=>Promise<T>,deadline:number,maximum?:number):Promise<T>{
  const remaining=promptProviderTimeout(deadline,maximum);let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([work(),new Promise<never>((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(deadline<=Date.now()?'REQUEST_DEADLINE':'PREPARATION_TIMEOUT')),remaining);timer.unref();
  })]);}finally{if(timer)clearTimeout(timer);}
}
