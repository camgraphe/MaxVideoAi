import {query,type QueryExecutor} from '@/lib/db';
import {z} from 'zod';
import type {StudioGenerationActor} from '@/server/agent-api/generation-actor';
import {studioTaskSchemaReady} from './repository';
export type StudioAuthoredNote={requestId:string;message:string;referenceIds:string[];createdAt:string;truncated:boolean};
/** Exact authored history, including legacy rows, with no summary/embedding call. */
async function notes(actor:StudioGenerationActor,text:string,exclude:string|null,db:QueryExecutor,full:boolean):Promise<StudioAuthoredNote[]> {
  if(!await studioTaskSchemaReady(db))return [];
  const terms=(text.match(/[\p{L}\p{N}]{3,}/gu)??[]).slice(0,20).join(' | ');
  const rows=await db.query<{request_id:string;message:string;reference_ids:string[];created_at:Date}>(`WITH authored AS (
    SELECT n.request_id,n.message,n.reference_ids,n.created_at FROM studio_task_memory_notes n
      JOIN studio_projects p ON p.id=n.project_id AND p.user_id=n.user_id AND p.deleted_at IS NULL WHERE n.user_id=$1 AND n.project_id=$2
    UNION ALL SELECT t.request_id,t.input_json->>'message',COALESCE(t.input_json->'references','[]'::jsonb),t.created_at FROM studio_image_turns t
      JOIN studio_projects p ON p.id=t.project_id AND p.user_id=t.user_id AND p.deleted_at IS NULL WHERE t.user_id=$1 AND t.project_id=$2
      AND NOT EXISTS(SELECT 1 FROM studio_task_memory_notes n WHERE n.user_id=t.user_id AND n.project_id=t.project_id AND n.request_id=t.request_id)
  ), initial AS (SELECT * FROM authored WHERE ($3::uuid IS NULL OR request_id<>$3) ORDER BY created_at,request_id LIMIT 1),
  relevant AS (SELECT a.* FROM authored a WHERE ($3::uuid IS NULL OR a.request_id<>$3) AND NOT EXISTS(SELECT 1 FROM initial i WHERE i.request_id=a.request_id)
    ORDER BY COALESCE(ts_rank(to_tsvector('simple',a.message),CASE WHEN $4='' THEN NULL ELSE to_tsquery('simple',$4) END),0) DESC,a.created_at DESC,a.request_id LIMIT 3)
  SELECT * FROM initial UNION ALL SELECT * FROM relevant`,[actor.userId,actor.projectId,exclude,terms]);
  return rows.map((row,index)=>{const bound=full||index===0?4000:1800;return {requestId:row.request_id,message:row.message.slice(0,bound),referenceIds:row.reference_ids.slice(0,8),createdAt:new Date(row.created_at).toISOString(),truncated:row.message.length>bound};});
}
export function readStudioTaskMemory(actor:StudioGenerationActor,message:string,requestId:string,db:QueryExecutor={query}) {return notes(actor,message,requestId,db,false);}
export function recallStudioTaskMemory(actor:StudioGenerationActor,text:string,db:QueryExecutor={query}) {return notes(actor,z.string().trim().min(1).max(300).parse(text),null,db,true);}
