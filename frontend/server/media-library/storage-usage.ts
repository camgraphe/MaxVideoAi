import { query } from '@/lib/db';
import { requireLibraryOwner } from './organization-validation';

/** Recorded original bytes, not a physical bucket inventory or a quota reservation.
 * Include recoverable Trash. Deduplicate identical original URLs across projections.
 * Unknown sizes stay unknown; no HEAD fan-out or schema bootstrap on this read. */
export async function readLibraryStorageUsage(userId: string) {
  requireLibraryOwner(userId);
  const [row] = await query<{ bytes: string; measured: string; files: string }>(`
    WITH originals AS (
      SELECT url, size_bytes FROM media_assets WHERE user_id=$1 AND deleted_at IS NULL AND status='ready'
      UNION ALL SELECT url, size_bytes FROM user_assets WHERE user_id=$1
      UNION ALL SELECT COALESCE(o.storage_url,o.url),NULL::bigint FROM job_outputs o
        JOIN app_jobs j ON j.job_id=o.job_id AND j.user_id=o.user_id
        WHERE o.user_id=$1 AND o.status='ready'
    ), files AS (
      SELECT url,CASE WHEN count(DISTINCT size_bytes) FILTER(WHERE size_bytes>=0)=1
        THEN max(size_bytes) FILTER(WHERE size_bytes>=0) END AS bytes
      FROM originals WHERE NULLIF(url,'') IS NOT NULL GROUP BY url
    ) SELECT COALESCE(sum(bytes),0)::text AS bytes,count(bytes)::text AS measured,count(*)::text AS files FROM files`, [userId]);
  return { recordedBytes: Number(row.bytes), measuredFiles: Number(row.measured), totalFiles: Number(row.files), limitBytes: null, enforcement: false };
}
