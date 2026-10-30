import {z} from 'zod';
import {query} from '@/lib/db';
import {inspectStudioAssistanceResolution} from '@/server/studio/assistance-resolution';

const userIdSchema=z.string().min(1).max(128).regex(/^\S(?:.*\S)?$/);
const optionsSchema=z.object({cursor:z.string().min(1).max(2048).regex(/^[A-Za-z0-9_-]+$/).optional(),limit:z.number().int().min(1).max(100).default(25)}).strict();
const cursorSchema=z.object({v:z.literal(1),userId:userIdSchema,id:z.string().uuid()}).strict();
type DiagnosticRow={call_id:string;created_at:string;reserved_nano_usd:string};
async function inspectCall(call:DiagnosticRow){
  let settlement:'ready'|'evidence_unavailable'|'already_settled';
  try {
    const preview=await inspectStudioAssistanceResolution(call.call_id,'settle_recorded');
    settlement=preview.callState==='settled'||preview.alreadyApplied?'already_settled':'ready';
  } catch(error) {
    if(!(error instanceof Error)||error.message!=='No valid, scoped recorded provider evidence is available.')throw error;
    settlement='evidence_unavailable';
  }
  return {callId:call.call_id,createdAt:call.created_at,supplierExposureNanoUsd:call.reserved_nano_usd,settlement};
}

/** Read-only diagnostic of the exact admission cap; no customer content or inferred usage. */
export async function diagnoseComposerRecovery(userId:string,options:{cursor?:string;limit?:number}={}){
  const input={userId:userIdSchema.parse(userId),...optionsSchema.parse(options)};
  let after:z.infer<typeof cursorSchema>|undefined;
  if(input.cursor){
    try{
      const decoded=Buffer.from(input.cursor,'base64url');
      if(decoded.toString('base64url')!==input.cursor)throw new Error('Invalid cursor');
      after=cursorSchema.parse(JSON.parse(decoded.toString('utf8')));
      if(after.userId!==input.userId)throw new Error('Cursor account changed');
    }catch{throw new Error('Invalid or mismatched diagnostic cursor.');}
  }
  // Count and page share one statement snapshot. UUID ordering permits bounded keyset paging;
  // a new diagnostic must be run after state changes, since pages are not a snapshot.
  const rows=await query<{total:number;calls:DiagnosticRow[]}>(`WITH scoped AS (
    SELECT c.id,c.created_at,c.reserved_nano_usd FROM studio_assistance_calls c
    WHERE c.user_id=$1 AND c.state<>'settled' AND EXISTS (
      SELECT 1 FROM studio_assistance_resolutions r WHERE r.call_id=c.id
      AND r.action='waive_unknown' AND r.operator_id='system:composer-unanswered')
  ) SELECT (SELECT count(*)::int FROM scoped) total,
    COALESCE((SELECT json_agg(row_to_json(p) ORDER BY p.call_id) FROM (
      SELECT id::text call_id,created_at::text,reserved_nano_usd::text FROM scoped
      WHERE ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT $3
    ) p),'[]'::json) calls`,[input.userId,after?.id??null,input.limit+1]);
  const result=rows[0];
  const page=result.calls.slice(0,input.limit),calls:Awaited<ReturnType<typeof inspectCall>>[]=[];
  // Each preview performs several reads. Bound pool pressure and drain each batch
  // before failing so a failed command leaves no inspections running in the background.
  for(let offset=0;offset<page.length;offset+=2){
    const batch=await Promise.allSettled(page.slice(offset,offset+2).map(inspectCall));
    for(const item of batch){if(item.status==='rejected')throw item.reason;calls.push(item.value);}
  }
  return {unreconciledCount:result.total,blocked:result.total>=3,calls,nextCursor:result.calls.length>input.limit?Buffer.from(JSON.stringify({v:1,userId:input.userId,id:calls.at(-1)!.callId})).toString('base64url'):null};
}
