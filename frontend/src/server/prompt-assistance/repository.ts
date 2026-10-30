import {createHash,randomUUID} from 'node:crypto';
import {query,withDbTransaction,type QueryExecutor,type TransactionQueryExecutor} from '@/lib/db';
import {stableJson} from '@/server/agent-api/generation-normalization';
import {promptSessionScope} from '@/lib/prompt-assistance/session';
import {lockAccount,openStudioAssistanceTurn} from '@/server/studio/assistance-ledger';
import type {StudioAssistancePolicy} from '@/server/studio/assistance-policy';
import type {StudioAssistantModel,MiloRuntimePolicy} from '@/lib/studio/assistance-contract';
import type {PromptAssistanceReply,PromptAssistanceRequest} from '@/lib/prompt-assistance/contract';
import type {Response} from 'openai/resources/responses/responses';

export type PromptRequestRow={user_id:string;session_id:string;request_id:string;input_hash:string;input_json:PromptAssistanceRequest;lease_id:string;lease_expires_at:Date;state:'preparing'|'calling'|'reported'|'complete'|'failed'|'unknown';model:StudioAssistantModel;runtime_policy?:MiloRuntimePolicy;call_id:string|null;context_json:unknown;response_json:Response|null;reply_json:PromptAssistanceReply|null;error:string|null};
const requestProjection="SELECT r.*,t.tariff_snapshot->'runtime' runtime_policy FROM prompt_assistance_requests r JOIN studio_assistance_turns t ON t.user_id=r.user_id AND t.project_id='composer:'||r.session_id::text AND t.request_id=r.request_id";
export const composerScope=(userId:string,sessionId:string)=>({userId,projectId:`composer:${sessionId}`});
export const promptScopeValues=(row:PromptRequestRow)=>[row.user_id,row.session_id,row.request_id];
export async function readPromptRequest(userId:string,sessionId:string,requestId:string,db:QueryExecutor={query}) {
  const row=(await db.query<PromptRequestRow>(requestProjection+' WHERE r.user_id=$1 AND r.session_id=$2 AND r.request_id=$3',[userId,sessionId,requestId]))[0];
  if(!row)throw new Error('REQUEST_NOT_FOUND');
  return row;
}
export async function claimPromptRequest(userId:string,input:PromptAssistanceRequest,policy:StudioAssistancePolicy) {
  if(!userId)throw new Error('UNAUTHORIZED');
  const hash=createHash('sha256').update(stableJson(input)).digest('hex');
  return withDbTransaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${userId}`]);
    if((await tx.query('SELECT 1 FROM prompt_assistance_abandoned_requests WHERE user_id=$1 AND session_id=$2 AND request_id=$3',[userId,input.sessionId,input.requestId])).length)throw new Error('REQUEST_CLOSED');
    const prior=(await tx.query<PromptRequestRow>(requestProjection+' WHERE r.user_id=$1 AND r.session_id=$2 AND r.request_id=$3',[userId,input.sessionId,input.requestId]))[0];
    if(prior){if(prior.input_hash!==hash)throw new Error('REQUEST_CONFLICT');return {row:prior,claimed:false};}
    // Never redispatch an expired call. Dispatched closeout requires the financial resolution path.
    await tx.query("UPDATE prompt_assistance_requests SET state=CASE WHEN call_id IS NULL THEN 'failed' ELSE 'unknown' END,error='REQUEST_INTERRUPTED',updated_at=clock_timestamp() WHERE user_id=$1 AND state IN ('preparing','calling') AND lease_expires_at<clock_timestamp()",[userId]);
    if((await tx.query("SELECT 1 FROM prompt_assistance_requests WHERE user_id=$1 AND state IN ('preparing','calling','reported','unknown') LIMIT 1",[userId])).length)throw new Error('REQUEST_PENDING');
    // Customer waivers cannot recycle purchased credits into unlimited unbilled
    // supplier calls. Manual support decisions do not consume this automatic cap.
    if((await tx.query(`SELECT c.id FROM studio_assistance_calls c JOIN studio_assistance_resolutions r ON r.call_id=c.id
      WHERE c.user_id=$1 AND c.state<>'settled' AND r.action='waive_unknown' AND r.operator_id='system:composer-unanswered'
      LIMIT 1 OFFSET 2`,[userId])).length)throw new Error('ASSISTANCE_RECOVERY_REQUIRED');
    await ensurePromptSession(userId,input.sessionId,input.draft,tx);
    const count=(await tx.query<{n:string}>('SELECT count(*)::text n FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2',[userId,input.sessionId]))[0];
    if(Number(count.n)>=100)throw new Error('SESSION_FULL');
    const account=await lockAccount(tx,userId,policy);
    if(input.assistanceModel!==undefined&&(account.selected_model!==input.assistanceModel||Number(account.revision)!==input.assistanceRevision))throw new Error('ASSISTANCE_SELECTION_CHANGED');
    const turn=await openStudioAssistanceTurn(composerScope(userId,input.sessionId),input.requestId,policy,tx);
    const row=(await tx.query<PromptRequestRow>(`INSERT INTO prompt_assistance_requests(user_id,session_id,request_id,input_hash,input_json,lease_id,state,model) VALUES($1,$2,$3,$4,$5::jsonb,$6,'preparing',$7) RETURNING *`,[userId,input.sessionId,input.requestId,hash,JSON.stringify(input),randomUUID(),turn.model]))[0];
    return {row:{...row,runtime_policy:turn.tariff_snapshot?.runtime},claimed:true};
  });
}
export async function readPromptHistory(row:PromptRequestRow) {
  const previous=await query<Pick<PromptRequestRow,'input_json'|'reply_json'>>(`SELECT input_json,reply_json FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 AND state='complete' AND request_id<>$3 ORDER BY created_at DESC LIMIT 8`,promptScopeValues(row));
  return previous.reverse().flatMap(item=>[{role:'user' as const,content:item.input_json.message},{role:'assistant' as const,content:JSON.stringify(item.reply_json)}]);
}

export async function ensurePromptSession(userId:string,sessionId:string,draft:{surface:string;mode:string;workflow?:string},tx:TransactionQueryExecutor) {
  const scope=promptSessionScope(draft);
  await tx.query('INSERT INTO prompt_assistance_sessions(user_id,id,scope) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[userId,sessionId,scope]);
  const session=(await tx.query<{scope:string;active:boolean}>('SELECT scope,expires_at>clock_timestamp() active FROM prompt_assistance_sessions WHERE user_id=$1 AND id=$2',[userId,sessionId]))[0];
  if(!session?.active)throw new Error('SESSION_EXPIRED');
  if(session.scope!==scope)throw new Error('SESSION_SCOPE_CHANGED');
}
