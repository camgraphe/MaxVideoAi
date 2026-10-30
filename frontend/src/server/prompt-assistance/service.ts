import {assistanceNextActionSchema} from '@/lib/studio/assistance-contract';
import {query,withDbTransaction} from '@/lib/db';
import {promptAssistanceReplySchema,promptAssistanceRequestSchema,type PromptAssistanceRequest,type PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import {studioAssistancePolicy,type StudioAssistancePolicy} from '@/server/studio/assistance-policy';
import {readStudioAssistanceStatus,reserveStudioAssistanceCall,settleStudioAssistanceCall,markStudioAssistanceUnknown} from '@/server/studio/assistance-ledger';
import {buildPromptAssistanceContext} from './context';
import {buildAssistantReviewContext} from '../assistant-review/context';
import {claimPromptRequest,composerScope,readPromptHistory,readPromptRequest,promptScopeValues,type PromptRequestRow} from './repository';
import {countPromptTokens,createPromptResponse,promptResponseParams,promptProviderTimeout,promptProviderFailure,PROMPT_REQUEST_BUDGET_MS} from './provider';
import {preparePromptPerception} from './perception';
import {closeUnansweredPromptRequest,closeExpiredPromptRequests} from './unanswered';
import {AgentApiError} from '@/server/agent-api/errors';

type Dependencies={policy?:StudioAssistancePolicy;buildContext?:typeof buildPromptAssistanceContext;count?:typeof countPromptTokens;create?:typeof createPromptResponse;perception?:typeof preparePromptPerception};
async function result(row:PromptRequestRow,policy:StudioAssistancePolicy):Promise<PromptAssistanceResult>{
  const nextAction=assistanceNextActionSchema.safeParse((row.context_json as {failureAction?:unknown}|null)?.failureAction);
  return {safeToRetry:row.state==='failed'&&!row.call_id,...(row.state==='failed'&&!row.call_id&&nextAction.success?{nextAction:nextAction.data}:{}),sessionId:row.session_id,requestId:row.request_id,draftRevision:row.input_json.draftRevision,target:row.input_json.draft.target,message:row.input_json.message,
    state:row.state==='complete'?'complete':row.state==='failed'?'failed':row.state==='unknown'||(row.call_id&&new Date(row.lease_expires_at).getTime()<Date.now())?'unknown':'pending',
    ...(row.reply_json?{reply:row.reply_json}:{}),...(row.error?{error:row.error}:{}),assistance:await readStudioAssistanceStatus(row.user_id,policy)};
}
/** Read only. Recovery settlement is an explicit POST of the original request. */
export async function readPromptAssistance(userId:string,sessionId:string,requestId:string,policy=studioAssistancePolicy()) {
  return result(await readPromptRequest(userId,sessionId,requestId),policy);
}
export async function recoverPromptAssistance(userId:string,sessionId:string,requestId:string,policy=studioAssistancePolicy()){
  const row=await withDbTransaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${userId}`]);
    const saved=(await tx.query<PromptRequestRow>('SELECT * FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 AND request_id=$3',[userId,sessionId,requestId]))[0];
    if(saved){
      if(saved.state==='preparing'&&!saved.call_id&&new Date(saved.lease_expires_at).getTime()<Date.now())return (await tx.query<PromptRequestRow>("UPDATE prompt_assistance_requests SET state='failed',error='REQUEST_INTERRUPTED',updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 RETURNING *",[userId,sessionId,requestId]))[0];
      return saved;
    }
    await tx.query('INSERT INTO prompt_assistance_abandoned_requests(user_id,session_id,request_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,sessionId,requestId]);
    return null;
  });
  if(!row)return {sessionId,requestId,draftRevision:0,target:'prompt' as const,message:'',state:'failed' as const,error:'REQUEST_NOT_FOUND',assistance:await readStudioAssistanceStatus(userId,policy)};
  if(!row.response_json)await closeUnansweredPromptRequest(userId,sessionId,requestId);
  const current=await readPromptRequest(userId,sessionId,requestId);
  return current.response_json?finishRecorded(current,policy):result(current,policy);
}
async function finishRecorded(row:PromptRequestRow,policy:StudioAssistancePolicy){
  if(!row.response_json||!row.call_id)return result(row,policy);
  return withDbTransaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${row.user_id}`]);
    row=await readPromptRequest(row.user_id,row.session_id,row.request_id,tx);
    if(row.state==='complete')return row;
    if(row.state==='failed'){
      // A waived request stays closed, but late supplier evidence can reconcile
      // exposure without recharging the customer or exposing a late suggestion.
      await settleStudioAssistanceCall(row.call_id!,row.user_id,row.response_json!,tx);
      return row;
    }
    const response=row.response_json!;
    if(!await settleStudioAssistanceCall(row.call_id!,row.user_id,response,tx)){
      return (await tx.query<PromptRequestRow>("UPDATE prompt_assistance_requests SET state='unknown',error='USAGE_UNRESOLVED',updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 RETURNING *",promptScopeValues(row)))[0];
    }
    let reply=null,error=null;
    try{
      if(response.status==='incomplete')throw new Error('OUTPUT_INCOMPLETE');
      if(response.status!=='completed')throw new Error('OUTPUT_INVALID');
      if(response.output?.some(item=>item.type==='message'&&item.content.some(part=>part.type==='refusal')))throw new Error('OUTPUT_REFUSED');
      reply=promptAssistanceReplySchema.parse(JSON.parse(response.output_text));
      const maxChars=(row.context_json as {maxChars:number}).maxChars;
      if(reply.text&&reply.text.length>maxChars)throw new Error('OUTPUT_TOO_LONG');
    }catch(cause){
      reply=null;
      error=cause instanceof Error&&['OUTPUT_INCOMPLETE','OUTPUT_REFUSED','OUTPUT_TOO_LONG'].includes(cause.message)?cause.message:'OUTPUT_INVALID';
    }
    const saved=(await tx.query<PromptRequestRow>('UPDATE prompt_assistance_requests SET state=$4,reply_json=$5::jsonb,error=$6,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 RETURNING *',[...promptScopeValues(row),error?'failed':'complete',JSON.stringify(reply),error]))[0];
    if(!error)await tx.query("UPDATE prompt_assistance_sessions SET expires_at=clock_timestamp()+interval '24 hours' WHERE user_id=$1 AND id=$2",[row.user_id,row.session_id]);
    return saved;
  }).then(saved=>result(saved,policy));
}
export async function sendPromptAssistance(userId:string,raw:PromptAssistanceRequest,deps:Dependencies={}) {
  const startedAt=Date.now(),deadline=startedAt+PROMPT_REQUEST_BUDGET_MS;
  const input=promptAssistanceRequestSchema.parse(raw),policy=deps.policy??studioAssistancePolicy();
  if(!policy.enabled)throw new Error('ASSISTANCE_DISABLED');
  await closeExpiredPromptRequests(userId);
  const {row,claimed}=await claimPromptRequest(userId,input,policy);
  if(!claimed)return row.response_json?finishRecorded(row,policy):result(row,policy);
  let dispatched=false,responseReceived=false;
  let reviewContext:Record<string,unknown>|undefined;
  try {
    const context=await (deps.buildContext??buildPromptAssistanceContext)(userId,input);
    const perceived=await(deps.perception??preparePromptPerception)(userId,input,row.model,context);
    const params=promptResponseParams(row,perceived.context,await readPromptHistory(row),perceived.content);
    reviewContext={...perceived.context,reviewInput:buildAssistantReviewContext(params)};
    const inputTokens=await(deps.count??countPromptTokens)(params,promptProviderTimeout(deadline,15_000));
    if(!Number.isSafeInteger(inputTokens)||inputTokens<1||inputTokens>32000)throw new Error('CONTEXT_TOO_LARGE');
    const call=await withDbTransaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${userId}`]);
      const current=await readPromptRequest(userId,input.sessionId,input.requestId,tx);
      if(current.state!=='preparing'||new Date(current.lease_expires_at).getTime()<=Date.now())throw new Error('REQUEST_INTERRUPTED');
      promptProviderTimeout(deadline);
      const reserved=await reserveStudioAssistanceCall({...composerScope(userId,input.sessionId),requestId:input.requestId,leaseId:row.lease_id,index:0,inputTokens,outputTokens:params.max_output_tokens??2200},policy,tx);
      await tx.query("UPDATE prompt_assistance_requests SET state='calling',call_id=$4,context_json=$5::jsonb,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3",[...promptScopeValues(row),reserved.id,JSON.stringify(reviewContext)]);
      promptProviderTimeout(deadline); // Exhaustion here rolls back the call and its hold.
      return reserved;
    });
    row.call_id=call.id;dispatched=true;
    const response=await (deps.create??createPromptResponse)(params,Math.max(1,deadline-Date.now()));
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
    await query("UPDATE prompt_assistance_requests SET state=$4,error=$5,context_json=COALESCE(context_json,'{}'::jsonb)||$6::jsonb,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND state NOT IN ('complete','failed')",[...promptScopeValues(row),dispatched?'unknown':'failed',known,JSON.stringify({...(providerFailure?{providerFailure}:{}),...(!dispatched&&reviewContext?{...reviewContext,reviewInput:{...(reviewContext.reviewInput as object),capturePoint:'prepared_not_dispatched'}}:{}),...(!dispatched&&nextAction.success?{failureAction:nextAction.data}:{})})]);
    if(dispatched&&!responseReceived){
      // This invocation has stopped awaiting the provider. Shorten only its own
      // unanswered lease; saved evidence and another lease always win.
      await query("UPDATE prompt_assistance_requests SET lease_expires_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND lease_id=$4 AND call_id=$5 AND state='unknown' AND response_json IS NULL",[...promptScopeValues(row),row.lease_id,row.call_id]);
      await closeUnansweredPromptRequest(userId,input.sessionId,input.requestId);
    }
    return result(await readPromptRequest(userId,input.sessionId,input.requestId),policy);
  }
}
