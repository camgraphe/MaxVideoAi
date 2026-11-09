import type { MediaKind } from '../media-library-records';
import type { MediaReadAccess } from '@/lib/media-read-access';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import { loadLibraryMediaReadAsset } from './exact-read-access';
import { createLibraryMediaReadAccess, libraryMediaReadDescriptor } from './read-access';

/** Called only after persistence. Preview failure cannot undo an acquired upload.
 * Resolve the exact stored row/fences; never hash request URLs or caller metadata. */
export async function createUploadedMediaReadAccess(userId: string, source: {
  assetId?: string | null; legacyAssetId: string; kind: MediaKind; url: string;
}): Promise<MediaReadAccess> {
  const reference: LibraryMediaReference = { type: source.assetId ? 'asset' : 'legacy', assetId: source.assetId || source.legacyAssetId, kind: source.kind };
  // A failed lookup still fences canonical private rendering without inventing a revision.
  let descriptor: MediaReadAccess = { readAccessOwnerId: userId, readAccessRef: reference };
  try {
    const { asset } = await loadLibraryMediaReadAsset(userId, reference);
    if (asset.url !== source.url) return descriptor;
    descriptor = { ...descriptor, ...libraryMediaReadDescriptor(userId, asset, reference), readAccessExpiresAt: new Date(0).toISOString() };
    return { ...descriptor, ...await createLibraryMediaReadAccess(userId, asset, reference) };
  } catch {
    return descriptor;
  }
}
