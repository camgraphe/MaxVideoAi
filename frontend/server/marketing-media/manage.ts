import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import { purgeMarketingStorageObjects } from '@/server/storage';
import { listMarketingPlacements, marketingPlacementTables } from './placements';
import { marketingMediaEnabled, readMarketingRow, type MarketingRow } from './store';
import { MarketingMediaError } from './snapshot';

type Dependencies = {
  db: QueryExecutor;
  transaction: <T>(run: (db: QueryExecutor) => Promise<T>) => Promise<T>;
  purge: (copyId: string) => Promise<unknown>;
  enabled: boolean;
};
const defaults = (): Dependencies => ({
  db: { query },
  transaction: withDbTransaction,
  purge: purgeMarketingStorageObjects,
  enabled: marketingMediaEnabled(),
});

export async function updateMarketingVisibility(
  videoId: string,
  patch: { visibility?: 'public' | 'private' | null; indexable?: boolean | null },
  dependencies = defaults(),
) {
  if (!dependencies.enabled) return null;
  return dependencies.transaction(async (db) => {
    const row = await readMarketingRow(videoId, db, true);
    if (!row) return null;
    if (row.state !== 'ready') throw new MarketingMediaError('The marketing copy is not ready.', 409);
    const visibility = patch.visibility ?? row.publication.visibility;
    const indexable = visibility === 'private' ? false : (patch.indexable ?? row.publication.indexable ?? true);
    await db.query(`UPDATE marketing_media SET publication=publication||$2::jsonb,updated_at=now() WHERE video_id=$1`, [
      videoId,
      JSON.stringify({ visibility, indexable }),
    ]);
    return { job_id: videoId, visibility, indexable };
  });
}

/** Resumable deletion only removes this publication's own namespace. Never a customer asset. */
export async function deleteMarketingVideo(videoId: string, dependencies = defaults()): Promise<boolean> {
  if (!dependencies.enabled) return false;
  const row = await dependencies.transaction(async (db) => {
    const tables = await marketingPlacementTables(db);
    await db.query("SET LOCAL lock_timeout='2s'");
    if (tables.size) await db.query(`LOCK TABLE ${[...tables].join(',')} IN SHARE MODE NOWAIT`);
    const current = await readMarketingRow(videoId, db, true);
    if (!current) return null;
    if (current.state === 'deleted') return current;
    if (current.state === 'copying' && current.lease_until && new Date(current.lease_until).getTime() > Date.now())
      throw new MarketingMediaError('Wait for the current copy to finish.', 409);
    const placements = await listMarketingPlacements(current, db, tables);
    if (placements.length)
      throw new MarketingMediaError(
        'This media is still used on the site. Remove its placements and unpublish it before deleting.',
        409,
      );
    const [claimed] = await db.query<MarketingRow>(
      `UPDATE marketing_media SET state='deleting',lease_until=NULL,updated_at=now() WHERE video_id=$1 RETURNING *`,
      [videoId],
    );
    return claimed;
  });
  if (!row) return false;
  if (row.state === 'deleted') return true;
  await dependencies.purge(row.copy_id);
  await dependencies.db.query(
    `UPDATE marketing_media SET state='deleted',publication='{}',recreation_snapshot='{}',files='[]',size_bytes=0,
  source_record='{}',source_snapshot='{}',last_error=NULL,updated_at=now() WHERE video_id=$1 AND state='deleting'`,
    [videoId],
  );
  return true;
}
