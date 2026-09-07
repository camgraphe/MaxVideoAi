import type { MediaKind } from '../media-library-records';

type OwnedOutput = {
  id: string; userId: string; kind: MediaKind; url: string; status: string; hidden: boolean;
  size: number | null; mime: string | null;
};
type MetadataDependencies = {
  readOutput: (id: string, userId: string) => Promise<OwnedOutput | null>;
  storageKey: (url: string) => string | null;
  head: (key: string, signal: AbortSignal) => Promise<{ size: number | null; mime: string | null }>;
};
export type RecentOutputMetadata = Pick<OwnedOutput, 'id' | 'userId' | 'kind' | 'url' | 'size' | 'mime'>;

/** One owned ready original, one configured-storage HEAD at most. No remote URL probing or writes. */
export async function resolveRecentOutputMetadata(id: string, userId: string, signal: AbortSignal, dependencies: MetadataDependencies): Promise<RecentOutputMetadata | null> {
  if (!id || !userId || id.length > 256 || id.trim() !== id) return null;
  signal.throwIfAborted();
  const output = await dependencies.readOutput(id, userId);
  signal.throwIfAborted();
  if (!output || output.id !== id || output.userId !== userId || output.hidden || output.status !== 'ready') return null;
  const sizeKnown = typeof output.size === 'number' && Number.isFinite(output.size) && output.size > 0;
  let size = sizeKnown ? output.size : null;
  let mime = output.mime;
  if (!sizeKnown || !mime) {
    const key = dependencies.storageKey(output.url);
    if (!key) return null;
    const metadata = await dependencies.head(key, signal);
    signal.throwIfAborted();
    size = metadata.size;
    mime = metadata.mime ?? mime;
  }
  if (!(typeof size === 'number' && Number.isFinite(size) && size > 0)) return null;
  if (mime && !mime.toLowerCase().startsWith(`${output.kind}/`)) return null;
  return { id: output.id, userId: output.userId, kind: output.kind, url: output.url, size, mime };
}

export async function readRecentOutputMetadata(id: string, userId: string, signal: AbortSignal) {
  const [{ query }, storage] = await Promise.all([import('@/lib/db'), import('@/server/storage')]);
  return resolveRecentOutputMetadata(id, userId, signal, {
    async readOutput(outputId, ownerId) {
      const rows = await query<OwnedOutput>(
        `SELECT o.id, o.user_id AS "userId", o.kind, COALESCE(o.storage_url, o.url) AS url,
                o.status, COALESCE(j.hidden, false) AS hidden, o.mime_type AS mime,
                CASE WHEN saved.kind = o.kind AND saved.url = COALESCE(o.storage_url, o.url)
                  THEN saved.size_bytes::double precision ELSE NULL END AS size
           FROM job_outputs o JOIN app_jobs j ON j.job_id = o.job_id
           LEFT JOIN media_assets saved ON saved.source_output_id = o.id
             AND saved.user_id = $2 AND saved.deleted_at IS NULL
          WHERE o.id = $1 AND o.user_id = $2 AND j.user_id = $2
            AND j.hidden IS NOT TRUE AND o.status = 'ready'
          LIMIT 1`, [outputId, ownerId]);
      return rows[0] ?? null;
    },
    storageKey: storage.extractStorageKeyFromUrl,
    head: storage.getStorageObjectMetadata,
  });
}
