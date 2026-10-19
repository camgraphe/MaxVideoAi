import { randomUUID } from 'node:crypto';
import { query, withDbTransaction, type QueryExecutor, type TransactionQueryExecutor } from '@/lib/db';
import type { CreatorOperationResult, CreatorOperationStatus } from '@/lib/toolbox/creator-tools';
import type { GenerationActor } from '@/server/agent-api/generation-actor';
import type { McpGenerationQuote } from '@/server/agent-api/quote-repository';
import type { PreparedCreatorProfile } from './creator-profiles';
import { refundCreatorFinalization } from './creator-operations-refund';

export type CreatorOperationSnapshot = PreparedCreatorProfile & { referenceFingerprint: string };
export type StoredCreatorOperation = { id:string;user_id:string;auth_origin:GenerationActor['authMethod'];oauth_client_id:string|null;studio_project_id:string|null;tool_id:CreatorOperationStatus['toolId'];profile_id:string;profile_revision:number;request_hash:string;snapshot:CreatorOperationSnapshot;status:CreatorOperationStatus['status'];result:CreatorOperationResult|null;error:string|null;version:number;lease_token:string|null;finalize_attempts:number;job_id:string|null;quote_state:string };
const executor: QueryExecutor = {query};
const scopeSql = 'o.id=$1 AND o.user_id=$2 AND o.auth_origin=$3 AND o.oauth_client_id IS NOT DISTINCT FROM $4 AND o.studio_project_id IS NOT DISTINCT FROM $5';
function scope(actor:GenerationActor,id:string) { return [id,actor.userId,actor.authMethod,actor.clientId,actor.authMethod==='studio-session'?actor.projectId:null]; }
export async function insertCreatorOperation(actor:GenerationActor,quote:McpGenerationQuote,snapshot:CreatorOperationSnapshot,tx:TransactionQueryExecutor):Promise<void> {
  await tx.query(`INSERT INTO creator_operations(id,user_id,auth_origin,oauth_client_id,studio_project_id,tool_id,profile_id,profile_revision,request_hash,snapshot)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [...scope(actor,quote.quoteId),snapshot.input.toolId,snapshot.profile.id,snapshot.profile.revision,quote.requestHash,JSON.stringify(snapshot)]);
}
export async function readCreatorOperation(actor:GenerationActor,id:string,db:QueryExecutor=executor,lock=false):Promise<StoredCreatorOperation> {
  const rows=await db.query<StoredCreatorOperation>(`SELECT o.*,q.job_id,q.state AS quote_state FROM creator_operations o
    JOIN mcp_generation_quotes q ON q.quote_id=o.id
    LEFT JOIN app_jobs j ON j.job_id=q.job_id
    WHERE ${scopeSql} AND (q.job_id IS NULL OR (j.user_id=o.user_id AND j.hidden IS NOT TRUE))${lock?' FOR SHARE OF o':''}`,scope(actor,id));
  if(!rows[0]) throw new Error('Tool operation is unavailable.');
  return rows[0];
}
export function creatorOperationView(row:StoredCreatorOperation):CreatorOperationStatus {
  const status=row.status==='prepared'&&row.job_id?'running':row.status;
  return {operationId:row.id,toolId:row.tool_id,jobId:row.job_id,status,result:row.result,error:row.error,retryAfterSeconds:['running','finalizing'].includes(status)?5:null};
}
export async function markCreatorRunning(actor:GenerationActor,id:string):Promise<void> {
  await query(`UPDATE creator_operations o SET status='running',updated_at=now() WHERE ${scopeSql} AND status='prepared'`,scope(actor,id));
}
export async function markCreatorFailed(actor:GenerationActor,id:string,message:string):Promise<void> {
  await query(`UPDATE creator_operations o SET status='failed',error=$6,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE ${scopeSql} AND status IN ('prepared','running')`,[...scope(actor,id),message]);
}
export async function claimCreatorFinalization(actor:GenerationActor,id:string):Promise<{token:string;version:number}|null> {
  const token=randomUUID();
  const rows=await query<{version:number}>(`UPDATE creator_operations o SET status='finalizing',lease_token=$6::uuid,
    lease_expires_at=now()+interval '10 minutes',version=version+1,finalize_attempts=finalize_attempts+1,error=NULL,updated_at=now()
    WHERE ${scopeSql} AND status IN ('prepared','running','finalizing')
      AND (lease_token IS NULL OR lease_expires_at<now()) AND (next_attempt_at IS NULL OR next_attempt_at<=now()) RETURNING version`,[...scope(actor,id),token]);
  return rows[0]?{token,version:rows[0].version}:null;
}
export async function settleCreatorFinalization(actor:GenerationActor,id:string,lease:{token:string;version:number},outcome:{result:CreatorOperationResult}|{error:string;permanent:boolean}):Promise<boolean> {
  const completed='result' in outcome;
  return withDbTransaction(async tx=>{
  const owned=await tx.query(`SELECT id FROM creator_operations o WHERE ${scopeSql} AND lease_token=$6::uuid AND version=$7 AND status='finalizing' FOR UPDATE`,[...scope(actor,id),lease.token,lease.version]);
  if(!owned.length)return false;
  if(!completed&&outcome.permanent) await refundCreatorFinalization(tx,actor.userId,id);
  const rows=await tx.query(`UPDATE creator_operations o SET status=$8,result=$9::jsonb,error=$10,
      lease_token=NULL,lease_expires_at=NULL,next_attempt_at=${completed?'NULL':"now()+interval '1 minute'"},updated_at=now()
    WHERE ${scopeSql} AND lease_token=$6::uuid AND version=$7 AND status='finalizing' RETURNING id`,
    [...scope(actor,id),lease.token,lease.version,completed?'completed':outcome.permanent?'failed':'finalizing',completed?JSON.stringify(outcome.result):null,completed?null:outcome.error+(outcome.permanent?' The charge was refunded.':'')]);
  return rows.length===1;
  });
}
/** Trusted worker inventory; each row is subsequently re-read through its exact actor scope. */
export async function listCreatorRefreshCandidates(limit=5):Promise<Array<{id:string;actor:GenerationActor}>> {
  const rows=await query<Pick<StoredCreatorOperation,'id'|'user_id'|'auth_origin'|'oauth_client_id'|'studio_project_id'>>(`SELECT o.id,o.user_id,o.auth_origin,o.oauth_client_id,o.studio_project_id
    FROM creator_operations o JOIN mcp_generation_quotes q ON q.quote_id=o.id JOIN app_jobs j ON j.job_id=q.job_id
    WHERE o.status IN ('prepared','running','finalizing') AND j.user_id=o.user_id AND j.hidden IS NOT TRUE
      AND (o.lease_token IS NULL OR o.lease_expires_at<now()) AND (o.next_attempt_at IS NULL OR o.next_attempt_at<=now()) ORDER BY o.updated_at LIMIT $1`,[Math.max(1,Math.min(10,Math.floor(limit)))]);
  return rows.map(row=>({id:row.id,actor:row.auth_origin==='studio-session'?{authMethod:'studio-session',userId:row.user_id,clientId:null,projectId:row.studio_project_id!}:row.auth_origin==='toolbox-session'?{authMethod:'toolbox-session',userId:row.user_id,clientId:null}:{authMethod:'oauth',userId:row.user_id,clientId:row.oauth_client_id,emailVerified:true}}));
}
