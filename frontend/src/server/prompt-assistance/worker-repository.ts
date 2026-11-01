import {randomUUID} from 'node:crypto';
import {query,withDbTransaction} from '@/lib/db';
import {readPromptRequest,promptScopeValues,type PromptRequestRow,type PromptRequestScope} from './repository';
import {PROMPT_WORKER_ATTEMPTS,promptWorkersReady} from './worker-policy';

type Work={kind:'execute'|'settle'|'close'|'closed';row:PromptRequestRow};
/** Candidate reads take no lock; each claim rechecks under the existing account
 * advisory lock and request row lock. No transaction surrounds external work. */
export async function claimPromptWork(scope:PromptRequestScope|undefined,executionOwner:string):Promise<Work|null>{
  if(!await promptWorkersReady())return null;
  const candidates=await query<PromptRequestRow>(`SELECT * FROM prompt_assistance_requests
    WHERE execution_version='durable-v1' AND execution_owner=$1
    AND ($2::text IS NULL OR (user_id=$2 AND session_id=$3 AND request_id=$4)) AND (
      (response_json IS NOT NULL AND state IN ('reported','unknown') AND error IS DISTINCT FROM 'USAGE_UNRESOLVED')
      OR (response_json IS NULL AND call_id IS NOT NULL AND state IN ('calling','unknown') AND lease_expires_at<=clock_timestamp())
      OR (response_json IS NULL AND call_id IS NULL AND state='preparing'
        AND (worker_started_at IS NULL OR lease_expires_at<=clock_timestamp() OR execution_deadline_at<=clock_timestamp())))
    ORDER BY (response_json IS NOT NULL) DESC,created_at LIMIT 10`,[executionOwner,scope?.userId??null,scope?.sessionId??null,scope?.requestId??null]);
  for(const candidate of candidates){
    const work=await withDbTransaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${candidate.user_id}`]);
      const row=(await tx.query<PromptRequestRow&{deadline_live:boolean;lease_live:boolean}>(`SELECT *,
        execution_deadline_at>clock_timestamp() deadline_live,lease_expires_at>clock_timestamp() lease_live
        FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 AND request_id=$3
        AND execution_version='durable-v1' AND execution_owner=$4 FOR UPDATE`,[...promptScopeValues(candidate),executionOwner]))[0];
      if(!row||row.state==='complete'||row.state==='failed')return null;
      if(row.response_json)return row.error==='USAGE_UNRESOLVED'?null:{kind:'settle' as const,row};
      if(row.call_id)return !row.lease_live?{kind:'close' as const,row}:null;
      if(row.state!=='preparing'||(row.worker_started_at&&row.lease_live&&row.deadline_live))return null;
      if(!row.deadline_live||Number(row.worker_attempts)>=PROMPT_WORKER_ATTEMPTS){
        const saved=(await tx.query<PromptRequestRow>(`UPDATE prompt_assistance_requests SET state='failed',error=$4,
          updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 RETURNING *`,
          [...promptScopeValues(row),row.deadline_live?'REQUEST_INTERRUPTED':'REQUEST_DEADLINE']))[0];
        return {kind:'closed' as const,row:saved};
      }
      await tx.query(`UPDATE prompt_assistance_requests SET lease_id=$4,
        lease_expires_at=LEAST(clock_timestamp()+interval '180 seconds',execution_deadline_at+interval '30 seconds'),
        worker_started_at=COALESCE(worker_started_at,clock_timestamp()),worker_attempts=worker_attempts+1,
        error=NULL,updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3`,[...promptScopeValues(row),randomUUID()]);
      return {kind:'execute' as const,row:await readPromptRequest(row.user_id,row.session_id,row.request_id,tx)};
    });
    if(work)return work;
  }
  return null;
}
/** Only the live preparation/call owner can renew. Expired leases cannot revive. */
export async function renewPromptWorkLease(scope:PromptRequestScope,leaseId:string){
  return (await query(`UPDATE prompt_assistance_requests SET
    lease_expires_at=LEAST(clock_timestamp()+interval '180 seconds',execution_deadline_at+interval '30 seconds'),
    updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND lease_id=$4
    AND execution_version='durable-v1' AND state IN ('preparing','calling')
    AND lease_expires_at>clock_timestamp() AND execution_deadline_at>clock_timestamp() RETURNING request_id`,
    [scope.userId,scope.sessionId,scope.requestId,leaseId])).length>0;
}
