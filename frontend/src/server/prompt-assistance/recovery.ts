import {randomUUID} from 'node:crypto';
import type {QueryExecutor} from '@/lib/db';
import type {AssistanceCall,StudioUsageEvidence} from '@/server/studio/assistance-ledger';

export const isComposerAssistanceScope=(scope:string)=>/^composer:[a-f0-9-]{36}$/.test(scope);
const values=(call:AssistanceCall)=>[call.user_id,call.project_id.slice('composer:'.length),call.request_id];
export async function readComposerAssistanceRecovery(call:AssistanceCall,db:QueryExecutor){
  const row=(await db.query<{state:string;lease_id:string;lease_expires_at:string;lease_active:boolean;response_json:StudioUsageEvidence|null}>(`SELECT state,lease_id,lease_expires_at::text,lease_expires_at>clock_timestamp() lease_active,response_json FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND call_id=$4`,[...values(call),call.id]))[0];
  const exists=(await db.query('SELECT 1 FROM prompt_assistance_sessions WHERE user_id=$1 AND id=$2',values(call).slice(0,2))).length>0;
  return {turn:row?{state:['preparing','calling','unknown'].includes(row.state)?'thinking':row.state==='complete'?'ready':row.state,lease_id:row.lease_id,lease_expires_at:row.lease_expires_at,lease_active:row.lease_active,has_draft:false,quote_id:null}:null,
    projectExists:exists,evidence:row?.response_json??null};
}
export async function lockComposerAssistanceRecovery(call:AssistanceCall,db:QueryExecutor){
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`prompt-assistance:${call.user_id}`]);
  await db.query('SELECT request_id FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 AND request_id=$3 FOR UPDATE',values(call));
}
export async function closeComposerAssistanceRecovery(call:AssistanceCall,db:QueryExecutor,error='SUPPORT_CLOSED'){
  const closed=await db.query("UPDATE prompt_assistance_requests SET state='failed',error=$6,lease_id=$4,lease_expires_at=clock_timestamp(),updated_at=clock_timestamp() WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND call_id=$5 AND (state='failed' OR (state IN ('preparing','calling','unknown') AND lease_expires_at<=clock_timestamp())) RETURNING request_id",[...values(call),randomUUID(),call.id,error]);
  if(!closed.length)throw new Error('The composer request changed before support closeout.');
}
