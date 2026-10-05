import {query,type QueryExecutor} from '@/lib/db';
import {isUntitledStudioProject} from '@/lib/studio/conversation-project-title';
import {readStudioProjectTitleFallbacks} from './conversation-project-naming';
import type {StudioProjectSummary} from '@/lib/studio/conversation-projects';

/** Read-only projection: no schema bootstrap, workspace JSON or transient media grants. */
export async function listStudioConversationProjects(userId:string,executor:QueryExecutor={query}):Promise<StudioProjectSummary[]> {
  const rows=await executor.query<{id:string;name:string;updated_at:Date|string;persistence_mode:string}>(
    `SELECT id, name, updated_at,
            persistence_mode
       FROM studio_projects
      WHERE user_id = $1 AND deleted_at IS NULL AND persistence_mode = 'connected'
      ORDER BY updated_at DESC, id DESC
      LIMIT 100`,[userId],
  );
  const titles=await readStudioProjectTitleFallbacks(userId,rows.filter(row=>isUntitledStudioProject(row.name)).map(row=>row.id),executor);
  return rows.map(row=>({id:row.id,name:titles.get(row.id)??row.name,updatedAt:new Date(row.updated_at).toISOString(),persistenceMode:row.persistence_mode==='connected'?'connected':'legacy'}));
}

/** Narrow redirect lookup; no workspace payload or request-time schema bootstrap. */
export async function readStudioConversationProjectId(userId:string,projectId:string,executor:QueryExecutor={query}):Promise<string|null> {
  const rows=await executor.query<{id:string}>(
    `SELECT id FROM studio_projects WHERE user_id=$1 AND id=$2 AND deleted_at IS NULL AND persistence_mode='connected'`,
    [userId,projectId],
  );
  return rows[0]?.id??null;
}
