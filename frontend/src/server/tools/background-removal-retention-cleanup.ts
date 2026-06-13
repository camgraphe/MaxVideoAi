import { query } from '@/lib/db';
import { ensureAssetSchema, ensureMediaLibrarySchema } from '@/lib/schema';
import { deleteStorageObjectByUrl } from '@/server/storage';

export const BACKGROUND_REMOVAL_PRORES_RETENTION_CLEANUP_LIMIT = 100;

type ExpiredMediaAssetRow = {
  id: string;
  url: string | null;
};

type ExpiredUserAssetRow = {
  asset_id: string;
  url: string | null;
};

export type BackgroundRemovalRetentionCleanupResult = {
  mediaAssetsDeleted: number;
  userAssetsDeleted: number;
  storageObjectsDeleted: number;
  storageObjectsFailed: number;
};

function resolveCleanupLimit(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return BACKGROUND_REMOVAL_PRORES_RETENTION_CLEANUP_LIMIT;
  return Math.min(500, Math.max(1, Math.round(value)));
}

export async function cleanupExpiredBackgroundRemovalProResAssets(params: {
  now?: Date;
  limit?: number | null;
} = {}): Promise<BackgroundRemovalRetentionCleanupResult> {
  await ensureMediaLibrarySchema();
  await ensureAssetSchema();

  const nowIso = (params.now ?? new Date()).toISOString();
  const limit = resolveCleanupLimit(params.limit);
  const mediaRows = await query<ExpiredMediaAssetRow>(
    `WITH expired AS (
       SELECT id
       FROM media_assets
       WHERE source = 'background-removal'
         AND deleted_at IS NULL
         AND metadata->>'outputCodec' = 'mov_proresks'
         AND COALESCE(metadata->>'expiresAt', '') <> ''
         AND metadata->>'expiresAt' <= $1
       ORDER BY created_at ASC
       LIMIT $2
     )
     UPDATE media_assets
        SET deleted_at = NOW(), status = 'deleted', updated_at = NOW()
      WHERE id IN (SELECT id FROM expired)
      RETURNING id, url`,
    [nowIso, limit]
  );

  const remaining = Math.max(0, limit - mediaRows.length);
  const userRows = remaining
    ? await query<ExpiredUserAssetRow>(
        `WITH expired AS (
           SELECT asset_id
           FROM user_assets
           WHERE source = 'background-removal'
             AND metadata->>'outputCodec' = 'mov_proresks'
             AND COALESCE(metadata->>'expiresAt', '') <> ''
             AND metadata->>'expiresAt' <= $1
           ORDER BY created_at ASC
           LIMIT $2
         )
         DELETE FROM user_assets
          WHERE asset_id IN (SELECT asset_id FROM expired)
          RETURNING asset_id, url`,
        [nowIso, remaining]
      )
    : [];

  const urls = new Set(
    [...mediaRows.map((row) => row.url), ...userRows.map((row) => row.url)].filter(
      (url): url is string => typeof url === 'string' && url.length > 0
    )
  );
  let storageObjectsDeleted = 0;
  let storageObjectsFailed = 0;

  for (const url of urls) {
    try {
      if (await deleteStorageObjectByUrl(url)) storageObjectsDeleted += 1;
    } catch (error) {
      storageObjectsFailed += 1;
      console.warn('[tools/background-removal] failed to delete expired ProRes object', {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    mediaAssetsDeleted: mediaRows.length,
    userAssetsDeleted: userRows.length,
    storageObjectsDeleted,
    storageObjectsFailed,
  };
}
