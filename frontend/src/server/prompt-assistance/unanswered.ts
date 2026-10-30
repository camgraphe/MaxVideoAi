import {query} from '@/lib/db';
import {waiveUnansweredComposerCall} from '@/server/studio/assistance-resolution';

/** Only expired, unanswered composer calls qualify. The existing resolution transaction
 * rechecks its entire fingerprint under request/account/wallet locks, revokes the lease,
 * releases customer holds and keeps unknown supplier exposure. Never dispatches. */
export async function closeUnansweredPromptRequest(userId:string,sessionId:string,requestId:string){
  const row=(await query<{call_id:string}>(`SELECT call_id FROM prompt_assistance_requests
    WHERE user_id=$1 AND session_id=$2 AND request_id=$3 AND call_id IS NOT NULL
    AND response_json IS NULL AND state IN ('calling','unknown') AND lease_expires_at<=clock_timestamp()`,[userId,sessionId,requestId]))[0];
  if(!row)return;
  try{
    await waiveUnansweredComposerCall(userId,row.call_id);
  }catch{
    // Evidence/lease changes must win. A failed closeout remains recoverable, never
    // authorizes a replay and never pretends that a refund or settlement succeeded.
    console.warn('[prompt-assistance] unanswered_closeout_deferred',{requestId,callId:row.call_id});
  }
}

/** A different chat can trigger recovery of an expired account-wide blocker. */
export async function closeExpiredPromptRequests(userId:string){
  const rows=await query<{session_id:string;request_id:string}>(`SELECT session_id,request_id FROM prompt_assistance_requests
    WHERE user_id=$1 AND call_id IS NOT NULL AND response_json IS NULL
    AND state IN ('calling','unknown') AND lease_expires_at<=clock_timestamp() ORDER BY created_at LIMIT 10`,[userId]);
  for(const row of rows)await closeUnansweredPromptRequest(userId,row.session_id,row.request_id);
}
