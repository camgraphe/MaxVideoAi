import { query } from '@/lib/db';
import { readGeneratedVideoFacts, type GeneratedVideoFacts } from '@/lib/generated-video-media-facts';

/** A client-provided output id or source label alone never authorizes probing. */
export async function resolveOwnedGeneratedVideo(params: {
  userId: string; sourceOutputId: string; sourceJobId?: string | null; url: string;
}, queryFn = query): Promise<{ mediaFacts: GeneratedVideoFacts | null }> {
  const rows = await queryFn<{ id: string; job_id: string; user_id: string; kind: string;
    url: string; storage_url: string | null; metadata: Record<string, unknown> }>(
    `SELECT id, job_id, user_id, kind, url, storage_url, metadata
       FROM job_outputs
      WHERE id = $1 AND user_id = $2 AND kind = 'video' AND status = 'ready'
        AND COALESCE(storage_url, url) = $3
        AND ($4::text IS NULL OR job_id = $4)
      LIMIT 1`, [params.sourceOutputId, params.userId, params.url, params.sourceJobId ?? null]);
  const row = rows[0];
  if (!row || row.id !== params.sourceOutputId || row.user_id !== params.userId || row.kind !== 'video'
    || (row.storage_url ?? row.url) !== params.url || (params.sourceJobId && row.job_id !== params.sourceJobId)) {
    throw new Error('OUTPUT_NOT_FOUND');
  }
  return { mediaFacts: readGeneratedVideoFacts(row.metadata?.mediaFacts, params.url) };
}
