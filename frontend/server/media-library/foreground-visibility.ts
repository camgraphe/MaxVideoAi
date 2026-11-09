import type { MediaAssetRecord } from '../media-library-records';
import { mutateLibraryOrganization } from './organization';
/** Explicit Save only. Background projection/promotion never clears Trash. */
export async function restoreForegroundLibraryAsset(
  userId: string,
  asset: MediaAssetRecord,
): Promise<void> {
  const reference = asset.publicId
    ? { type: 'asset' as const, assetId: asset.publicId, kind: asset.kind }
    : { type: 'legacy' as const, assetId: asset.id, kind: asset.kind };
  const result = await mutateLibraryOrganization({
    userId,
    operation: 'restore',
    references: [reference],
  });
  if (result.succeededCount !== 1 || result.failedCount)
    throw new Error('SAVED_ASSET_RESTORE_FAILED');
}
