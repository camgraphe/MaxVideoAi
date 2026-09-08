import { query } from '@/lib/db';
import { ensureMediaLibrarySchema } from '@/lib/schema';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';

type OwnedSource = { source: ToolAssetRef; url: string };
type SourceRow = { id: string; job_id: string | null; url: string };

const defaultDependencies = { query, ensureMediaLibrarySchema };
export function createFinishingSourceResolver(dependencies: Partial<typeof defaultDependencies> = {}) {
  const { query, ensureMediaLibrarySchema } = { ...defaultDependencies, ...dependencies };
/** Read-only bridge for legacy upload/library readers. A URL is never ownership proof. */
async function findOwnedFinishingSource(userId: string, url: string): Promise<OwnedSource> {
  await ensureMediaLibrarySchema();
  const assets = await query<SourceRow>(`SELECT a.public_id AS id, NULL AS job_id, a.url
    FROM media_assets a LEFT JOIN app_jobs j ON j.job_id = a.source_job_id
    WHERE a.user_id = $1 AND a.url = $2 AND a.kind = 'video' AND a.status = 'ready' AND a.deleted_at IS NULL
      AND (a.source_job_id IS NULL OR (j.user_id = $1 AND j.status = 'completed' AND j.hidden IS NOT TRUE))
    ORDER BY a.created_at DESC LIMIT 1`, [userId, url]);
  if (assets[0]) return { source: toolAssetRefSchema.parse({ type: 'asset', assetId: assets[0].id, kind: 'video' }), url: assets[0].url };
  const outputs = await query<SourceRow>(`SELECT o.id, o.job_id, COALESCE(o.storage_url, o.url) AS url FROM job_outputs o
    JOIN app_jobs j ON j.job_id = o.job_id AND j.user_id = $1
    WHERE o.user_id = $1 AND o.kind = 'video' AND o.status = 'ready' AND (o.url = $2 OR o.storage_url = $2)
      AND j.status = 'completed' AND j.hidden IS NOT TRUE ORDER BY o.created_at DESC LIMIT 1`, [userId, url]);
  if (!outputs[0]) throw new Error('SOURCE_UNAVAILABLE');
  return { source: toolAssetRefSchema.parse({ type: 'job-output', jobId: outputs[0].job_id, outputId: outputs[0].id, kind: 'video' }), url: outputs[0].url };
}

async function resolveFinishingSource(userId: string, source: ToolAssetRef): Promise<OwnedSource> {
  toolAssetRefSchema.parse(source);
  if (source.kind !== 'video') throw new Error('SOURCE_UNAVAILABLE');
  await ensureMediaLibrarySchema();
  const rows = source.type === 'asset'
    ? await query<{ url: string }>(`SELECT a.url FROM media_assets a LEFT JOIN app_jobs j ON j.job_id = a.source_job_id
      WHERE a.user_id = $1 AND a.public_id = $2 AND a.kind = 'video' AND a.status = 'ready' AND a.deleted_at IS NULL
        AND (a.source_job_id IS NULL OR (j.user_id = $1 AND j.status = 'completed' AND j.hidden IS NOT TRUE)) LIMIT 1`, [userId, source.assetId])
    : await query<{ url: string }>(`SELECT COALESCE(o.storage_url, o.url) AS url FROM job_outputs o
      JOIN app_jobs j ON j.job_id = o.job_id AND j.user_id = $1
      WHERE o.user_id = $1 AND o.id = $2 AND o.job_id = $3 AND o.kind = 'video' AND o.status = 'ready'
        AND j.status = 'completed' AND j.hidden IS NOT TRUE LIMIT 1`, [userId, source.outputId, source.jobId]);
  if (!rows[0]?.url || !/^https:\/\//.test(rows[0].url)) throw new Error('SOURCE_UNAVAILABLE');
  return { source, url: rows[0].url };
}

  return { findOwnedFinishingSource, resolveFinishingSource };
}
export const { findOwnedFinishingSource, resolveFinishingSource } = createFinishingSourceResolver();
