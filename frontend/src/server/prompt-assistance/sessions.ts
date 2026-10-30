import {createHash} from 'node:crypto';
import {query} from '@/lib/db';
import type {PromptAssistanceRequest,PromptAssistanceReply} from '@/lib/prompt-assistance/contract';
import {canonicalPromptDraft,promptSessionScopeSchema,type PromptSessionSnapshot} from '@/lib/prompt-assistance/session';

/** Read only, account-owned and bounded. Never projects the provider input, references or billing ledger. */
export async function readPromptSession(userId:string,sessionId:string,scope:string):Promise<PromptSessionSnapshot> {
  promptSessionScopeSchema.parse(scope);
  const session=(await query<{scope:string;active:boolean}>(
    'SELECT scope,expires_at>clock_timestamp() active FROM prompt_assistance_sessions WHERE user_id=$1 AND id=$2',[userId,sessionId]))[0];
  if(!session)throw new Error('SESSION_NOT_FOUND');
  if(session.scope!==scope)throw new Error('SESSION_SCOPE_CHANGED');
  const rows=await query<{request_id:string;state:string;input_json:PromptAssistanceRequest;reply_json:PromptAssistanceReply|null}>(
    'SELECT request_id,state,input_json,reply_json FROM prompt_assistance_requests WHERE user_id=$1 AND session_id=$2 ORDER BY created_at,request_id LIMIT 100',[userId,sessionId]);
  const snapshot:PromptSessionSnapshot={sessionId,scope,status:!session.active?'expired':rows.length>=100?'full':'active',turns:[],proposal:null,pending:null};
  for(const row of rows){
    if(['preparing','calling','reported','unknown'].includes(row.state))snapshot.pending={requestId:row.request_id};
    if(row.state!=='complete'||!row.reply_json)continue;
    snapshot.turns.push({requestId:row.request_id,message:row.input_json.message,reply:row.reply_json.reply});
    const text=row.reply_json.text??row.input_json.activeSuggestion;
    if(text)snapshot.proposal={text,draftFingerprint:createHash('sha256').update(canonicalPromptDraft(row.input_json.draft)).digest('hex')};
  }
  return snapshot;
}
