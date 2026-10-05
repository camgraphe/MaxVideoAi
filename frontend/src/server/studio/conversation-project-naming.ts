import {createHash} from 'node:crypto';
import {query,withDbTransaction,type QueryExecutor,type TransactionQueryExecutor} from '@/lib/db';
import {automaticStudioProjectTitle,isUntitledStudioProject,normalizeStudioProjectName,studioProjectNameSchema} from '@/lib/studio/conversation-project-title';
import {StudioConnectedPersistenceError} from './montage-command';

const automaticKind='auto_title_studio_conversation',manualKind='rename_studio_conversation';
type Actor={userId:string;projectId:string};
type NameResult={projectId:string;name:string;updatedAt:string};

/** Bounded read projection for older untitled chats; never persists on a read. */
export async function readStudioProjectTitleFallbacks(userId:string,projectIds:string[],executor:QueryExecutor={query}):Promise<Map<string,string>> {
  if(!projectIds.length)return new Map();
  const rows=await executor.query<{id:string;messages:string[]}>(`SELECT p.id, ARRAY(
    SELECT left(t.input_json->>'message',240) FROM studio_image_turns t
    WHERE t.user_id=p.user_id AND t.project_id=p.id ORDER BY t.created_at,t.request_id LIMIT 10
  ) AS messages FROM studio_projects p WHERE p.user_id=$1 AND p.id=ANY($2::text[])
    AND p.deleted_at IS NULL AND p.persistence_mode='connected'
    AND NOT EXISTS(SELECT 1 FROM studio_project_commands c WHERE c.user_id=p.user_id AND c.project_id=p.id AND c.command_kind=$3)`,[userId,projectIds.slice(0,100),manualKind]);
  return new Map(rows.flatMap(row=>{const title=row.messages.map(automaticStudioProjectTitle).find(Boolean);return title?[[row.id,title] as [string,string]]:[];}));
}

/** Project names are metadata; title writes do not advance timeline revisions. */
export async function automaticallyNameStudioProject(actor:Actor,source:'message'|'assistant',proposed:string|null|undefined,executor:TransactionQueryExecutor):Promise<void> {
  if(!proposed)return;
  const optionalTitle=source==='assistant'?studioProjectNameSchema.safeParse(proposed):null;
  const name=source==='message'?automaticStudioProjectTitle(proposed):optionalTitle?.success&&optionalTitle.data.length<=80?optionalTitle.data:null;
  if(!name||isUntitledStudioProject(name))return;
  const row=(await executor.query<{name:string}>(`SELECT name FROM studio_projects WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL FOR UPDATE`,[actor.userId,actor.projectId]))[0];
  if(!row||source==='message'&&!isUntitledStudioProject(row.name))return;
  const connected=await executor.query(`SELECT id FROM studio_projects WHERE user_id=$1 AND id=$2 AND persistence_mode='connected'`,[actor.userId,actor.projectId]);
  if(!connected.length)return;
  const receipts=await executor.query<{command_kind:string;request_payload:{source?:string};safe_result:NameResult}>(`SELECT command_kind,request_payload,safe_result FROM studio_project_commands WHERE user_id=$1 AND project_id=$2 AND command_kind=ANY($3::text[])`,[actor.userId,actor.projectId,[automaticKind,manualKind]]);
  if(receipts.some(r=>r.command_kind===manualKind||r.request_payload.source===source))return;
  const fallback=receipts.find(r=>r.command_kind===automaticKind&&r.request_payload.source==='message');
  if(source==='assistant'&&!isUntitledStudioProject(row.name)&&row.name!==fallback?.safe_result.name)return;
  // Earlier substantive messages win over a later short follow-up after an upgrade.
  const historical=source==='message'?(await readStudioProjectTitleFallbacks(actor.userId,[actor.projectId],executor)).get(actor.projectId):null;
  await writeName(executor,actor,historical??name,automaticKind,`${source}:${actor.projectId}`,{source,name:historical??name});
}

async function writeName(executor:QueryExecutor,actor:Actor,name:string,kind:string,key:string,payload:unknown):Promise<NameResult> {
  const row=(await executor.query<{name:string;updated_at:Date|string}>(`UPDATE studio_projects SET name=$3,updated_at=clock_timestamp() WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL AND persistence_mode='connected' RETURNING name,updated_at`,[actor.userId,actor.projectId,name]))[0];
  if(!row)throw new Error('STUDIO_PROJECT_NOT_FOUND');
  const result={projectId:actor.projectId,name:row.name,updatedAt:new Date(row.updated_at).toISOString()};
  const json=JSON.stringify(payload),hash=createHash('sha256').update(json).digest('hex');
  const receipt=await executor.query(`INSERT INTO studio_project_commands(user_id,command_kind,command_version,idempotency_key,request_hash,project_id,sequence_id,request_payload,safe_result) SELECT $1,$2,1,$3,$4,$5,s.id,$6::jsonb,$7::jsonb FROM studio_sequences s WHERE s.user_id=$1 AND s.project_id=$5 ORDER BY s.created_at,s.id LIMIT 1 RETURNING id`,[actor.userId,kind,key,hash,actor.projectId,json,JSON.stringify(result)]);
  if(!receipt.length)throw new Error('STUDIO_PROJECT_NOT_FOUND');
  return result;
}

export async function renameStudioConversationProject(actor:Actor,input:{name:unknown;idempotencyKey:string}):Promise<NameResult> {
  const name=normalizeStudioProjectName(input.name);
  if(!actor.userId||!actor.projectId||!input.idempotencyKey||input.idempotencyKey.length>128)throw new Error('Invalid Studio project name.');
  const payload={projectId:actor.projectId,name},hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return withDbTransaction(async executor=>{
    const project=await executor.query(`SELECT id FROM studio_projects WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL AND persistence_mode='connected' FOR UPDATE`,[actor.projectId,actor.userId]);
    if(!project.length)throw new Error('STUDIO_PROJECT_NOT_FOUND');
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${actor.userId}:${manualKind}:${input.idempotencyKey}`]);
    const receipt=(await executor.query<{request_hash:string;safe_result:NameResult}>(`SELECT request_hash,safe_result FROM studio_project_commands WHERE user_id=$1 AND command_kind=$2 AND command_version=1 AND idempotency_key=$3`,[actor.userId,manualKind,input.idempotencyKey]))[0];
    if(receipt){if(receipt.request_hash!==hash)throw new StudioConnectedPersistenceError('STUDIO_IDEMPOTENCY_CONFLICT',409);return receipt.safe_result;}
    return writeName(executor,actor,name,manualKind,input.idempotencyKey,payload);
  });
}
