import { query, type QueryExecutor } from '@/lib/db';
import type { ActivityOrigin } from '@/types/jobs';

type OriginRecord = {
  job_id: string;
  auth_origin: unknown;
  studio_project_id: unknown;
};

function projectOrigin(row: OriginRecord): ActivityOrigin | null {
  if (row.auth_origin === 'oauth' && row.studio_project_id === null) return { kind: 'mcp' };
  if (row.auth_origin === 'studio-session' && typeof row.studio_project_id === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(row.studio_project_id)) {
    return { kind: 'studio', projectId: row.studio_project_id };
  }
  return null;
}

/** Optional web-only provenance. Reads migrated tables; never initializes or repairs them. */
export async function readActivityOrigins(
  userId: string,
  jobIds: string[],
  executor: QueryExecutor = { query },
): Promise<Map<string, ActivityOrigin>> {
  const ids = [...new Set(jobIds)];
  if (!userId.trim() || !ids.length) return new Map();
  const rows = await executor.query<OriginRecord>(
    `SELECT q.job_id, q.auth_origin, q.studio_project_id
       FROM mcp_generation_quotes q
       JOIN app_jobs j ON j.job_id = q.job_id AND j.user_id = q.user_id
      WHERE q.user_id = $1 AND q.job_id = ANY($2::text[])
        AND q.state = 'accepted' AND j.hidden IS NOT TRUE`,
    [userId, ids],
  );
  const origins = new Map<string, ActivityOrigin>();
  const unresolved = new Set<string>();
  for (const row of rows) {
    const origin = projectOrigin(row);
    const previous = origins.get(row.job_id);
    if (!origin || (previous && (previous.kind !== origin.kind
      || (previous.kind === 'studio' && origin.kind === 'studio' && previous.projectId !== origin.projectId)))) {
      unresolved.add(row.job_id);
    } else {
      origins.set(row.job_id, origin);
    }
  }
  for (const jobId of unresolved) origins.delete(jobId);
  return origins;
}
