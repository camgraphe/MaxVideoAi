import {promptWorkersEnabled,promptWorkersReady} from './worker-policy';
import {assistanceNextActionSchema} from '@/lib/studio/assistance-contract';
import {withDbTransaction} from '@/lib/db';
import {promptAssistanceRequestSchema,type PromptAssistanceRequest,type PromptAssistanceResult} from '@/lib/prompt-assistance/contract';
import {studioAssistancePolicy,type StudioAssistancePolicy} from '@/server/studio/assistance-policy';
import {readStudioAssistanceStatus,settleStudioAssistanceCall} from '@/server/studio/assistance-ledger';
import {claimPromptRequest,readPromptRequest,promptScopeValues,promptRequestPhase,type PromptRequestRow} from './repository';
import {closeUnansweredPromptRequest,closeExpiredPromptRequests} from './unanswered';
import {parsePromptProviderReply} from './reply-format';

export async function projectPromptResult(row:PromptRequestRow,policy:StudioAssistancePolicy):Promise<PromptAssistanceResult>{
  const nextAction=assistanceNextActionSchema.safeParse((row.context_json as {failureAction?:unknown}|null)?.failureAction);
  return {safeToRetry:row.state==='failed'&&!row.call_id,...(row.state==='failed'&&!row.call_id&&nextAction.success?{nextAction:nextAction.data}:{}),sessionId:row.session_id,requestId:row.request_id,draftRevision:row.input_json.draftRevision,target:row.input_json.draft.target,message:row.input_json.message,
    state:row.state==='complete'?'complete':row.state==='failed'?'failed':row.state==='unknown'||(row.call_id&&new Date(row.lease_expires_at).getTime()<Date.now())?'unknown':'pending',
    ...(promptRequestPhase(row)?{phase:promptRequestPhase(row)}:{}),...(row.execution_deadline_at?{deadlineAt:new Date(row.execution_deadline_at).toISOString()}:{}),
    ...(row.reply_json?{reply:row.reply_json}:{}),...(row.error?{error:row.error}:{}),assistance:await readStudioAssistanceStatus(row.user_id,policy)};
}
/** Read only. Recovery settlement is an explicit POST of the original request. */
export async function readPromptAssistance(userId:string,sessionId:string,requestId:string,policy=studioAssistancePolicy()) {
  return projectPromptResult(await readPromptRequest(userId,sessionId,requestId),policy);
}
export async function recoverPromptAssistance(userId:string,sessionId:string,requestId:string,policy=studioAssistancePolicy()){
  const row=await withDbTransaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${userId}`]);
    const saved=(await tx.query<PromptRequestRow&{deadline_expired:boolean;lease_expired:boolean}>(`SELECT *,(to_jsonb(prompt_assistance_requests)->>'execution_deadline_at')::timestamptz<=clock_timestamp() deadline_expired,lease_expires_at<=clock_timestamp() lease_expired FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 AND request_id=$3 FOR UPDATE`,[userId,sessionId,requestId]))[0];
    if(saved){
      if(saved.state==='preparing'&&!saved.call_id&&(saved.execution_version==='durable-v1'?saved.deadline_expired:saved.lease_expired))return (await tx.query<PromptRequestRow>("UPDATE prompt_assistance_requests SET state='failed',error=$4,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 RETURNING *",[userId,sessionId,requestId,saved.execution_version==='durable-v1'?'REQUEST_DEADLINE':'REQUEST_INTERRUPTED']))[0];
      return saved;
    }
    await tx.query('INSERT INTO prompt_assistance_abandoned_requests(user_id,session_id,request_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,sessionId,requestId]);
    return null;
  });
  if(!row)return {sessionId,requestId,draftRevision:0,target:'prompt' as const,message:'',state:'failed' as const,error:'REQUEST_NOT_FOUND',assistance:await readStudioAssistanceStatus(userId,policy)};
  if(!row.response_json)await closeUnansweredPromptRequest(userId,sessionId,requestId);
  const current=await readPromptRequest(userId,sessionId,requestId);
  return current.response_json?finishRecorded(current,policy):projectPromptResult(current,policy);
}
export async function finishRecorded(row:PromptRequestRow,policy:StudioAssistancePolicy){
  if(!row.response_json||!row.call_id)return projectPromptResult(row,policy);
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
      reply=parsePromptProviderReply(response.output_text,row.context_json);
      const maxChars=(row.context_json as {maxChars:number}).maxChars;
      if(reply.text&&reply.text.length>maxChars)throw new Error('OUTPUT_TOO_LONG');
    }catch(cause){
      reply=null;
      error=cause instanceof Error&&['OUTPUT_INCOMPLETE','OUTPUT_REFUSED','OUTPUT_TOO_LONG'].includes(cause.message)?cause.message:'OUTPUT_INVALID';
    }
    const saved=(await tx.query<PromptRequestRow>('UPDATE prompt_assistance_requests SET state=$4,reply_json=$5::jsonb,error=$6,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 RETURNING *',[...promptScopeValues(row),error?'failed':'complete',JSON.stringify(reply),error]))[0];
    if(!error)await tx.query("UPDATE prompt_assistance_sessions SET expires_at=clock_timestamp()+interval '24 hours' WHERE user_id=$1 AND id=$2",[row.user_id,row.session_id]);
    return saved;
  }).then(saved=>projectPromptResult(saved,policy));
}
export async function sendPromptAssistance(userId:string,raw:PromptAssistanceRequest,deps:{policy?:StudioAssistancePolicy;workersEnabled?:boolean;executionOwner?:string}={}) {
  const input=promptAssistanceRequestSchema.parse(raw),policy=deps.policy??studioAssistancePolicy();
  if(!policy.enabled)throw new Error('ASSISTANCE_DISABLED');
  // A disabled/unmigrated new worker must not mutate financial closeouts.
  if((deps.workersEnabled??promptWorkersEnabled())&&await promptWorkersReady())await closeExpiredPromptRequests(userId);
  const {row}=await claimPromptRequest(userId,input,policy,{enabled:deps.workersEnabled,executionOwner:deps.executionOwner});
  return row.response_json?finishRecorded(row,policy):projectPromptResult(row,policy);
}
