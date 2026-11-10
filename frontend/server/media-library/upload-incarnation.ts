import { createHash } from 'node:crypto';
import { query, type QueryExecutor } from '@/lib/db';
import { isOwnedMediaStorageKey } from '@/server/storage-read';

/** An explicit new import cannot reuse bytes/URLs retired by permanent deletion. */
export async function resolveExplicitUploadObjectKey(
  userId: string,
  initialKey: string,
  executor: QueryExecutor = { query },
): Promise<string> {
  if (!initialKey.startsWith('user-assets/by-content/') || !isOwnedMediaStorageKey({ key: initialKey, userId })) {
    throw new Error('Invalid owned upload key.');
  }
  const slash = initialKey.lastIndexOf('/');
  const directory = initialKey.slice(0, slash + 1), leaf = initialKey.slice(slash + 1);
  let key = initialKey;
  // Repeated purge/import cycles follow only actual object plans. A bounded failure
  // is preferable to silently reviving an old source after an excessive history.
  for (let generation = 0; generation < 32; generation++) {
    const rows = await executor.query<{ organization_key: string; source_revision: string; state: string }>(
      `SELECT organization_key,source_revision,state FROM (
         SELECT r.organization_key,r.source_revision,r.state,r.requested_at
         FROM library_purge_tokens t JOIN library_purge_requests r USING(user_id,organization_key)
         WHERE t.user_id=$1 AND t.token_hash=$3 AND r.state IN ('pending','deleting')
         UNION ALL
         SELECT r.organization_key,r.source_revision,r.state,r.requested_at
         FROM library_purge_objects o JOIN library_purge_requests r USING(user_id,organization_key)
         WHERE o.user_id=$1 AND o.object_key=$2 AND o.role='original' AND r.state='completed'
       ) retired ORDER BY (state<>'completed') DESC,requested_at DESC,organization_key LIMIT 1`,
      [userId, key, createHash('sha256').update(`storage-path:${key}`).digest('hex')],
    );
    const retired = rows[0];
    if (!retired) return key;
    if (retired.state !== 'completed') throw new Error('Storage object is being deleted; retry upload.');
    const revision = createHash('sha256').update(JSON.stringify([key, retired.organization_key, retired.source_revision])).digest('hex');
    key = `${directory}reimport-${revision}-${leaf}`;
  }
  throw new Error('Upload purge history exceeds the supported identity limit.');
}
