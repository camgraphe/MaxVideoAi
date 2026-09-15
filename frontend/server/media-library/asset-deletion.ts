import { type TransactionQueryExecutor, withDbTransaction } from '@/lib/db';
import { ensureAssetSchema, ensureMediaLibrarySchema } from '@/lib/schema';

type DeleteLibraryAssetDependencies = {
  ensureSchema(): Promise<void>;
  withTransaction<TResult>(callback: (executor: TransactionQueryExecutor) => Promise<TResult>): Promise<TResult>;
};

const defaultDependencies: DeleteLibraryAssetDependencies = {
  async ensureSchema() {
    await ensureMediaLibrarySchema();
    await ensureAssetSchema();
  },
  withTransaction: (callback) => withDbTransaction((executor) => callback(executor)),
};

export async function deleteLibraryAsset(
  params: { userId: string; assetId: string },
  dependencies: DeleteLibraryAssetDependencies = defaultDependencies,
): Promise<'deleted' | 'not_found'> {
  await dependencies.ensureSchema();
  return dependencies.withTransaction(async (executor) => {
    const rows = await executor.query<{ id: string; public_id: string | null; url: string }>(
      `SELECT id, public_id, url
         FROM media_assets
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE`,
      [params.assetId, params.userId],
    );
    const asset = rows[0];
    if (!asset) return 'not_found';

    const deleted = await executor.query<{ id: string }>(
      `UPDATE media_assets
          SET deleted_at = NOW(), updated_at = NOW(), status = 'deleted'
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
        RETURNING id`,
      [asset.id, params.userId],
    );
    if (deleted.length !== 1) return 'not_found';

    await executor.query(
      `DELETE FROM user_assets
        WHERE user_id = $1 AND url = $2
          AND NOT EXISTS (SELECT 1 FROM media_assets AS live
            WHERE live.id = user_assets.asset_id
              AND live.user_id = user_assets.user_id
              AND live.url = user_assets.url
              AND live.deleted_at IS NULL)`,
      [params.userId, asset.url],
    );

    if (asset.public_id) {
      await executor.query(
        `UPDATE mcp_reference_upload_cleanup_objects AS cleanup
            SET state = 'released', updated_at = clock_timestamp()
           FROM mcp_reference_upload_attempts AS attempts
          WHERE attempts.session_id = cleanup.session_id
            AND attempts.upload_id = cleanup.upload_id
            AND attempts.user_id = cleanup.user_id
            AND attempts.media_kind = cleanup.media_kind
            AND attempts.user_id = $1
            AND attempts.staged_asset_id = $2
            AND attempts.state = 'completed'
            AND cleanup.state = 'retained'
            AND cleanup.object_role IN ('final', 'thumbnail')`,
        [params.userId, asset.public_id],
      );
    }
    return 'deleted';
  });
}
