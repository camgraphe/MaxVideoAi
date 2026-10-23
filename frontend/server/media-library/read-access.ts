import type { MediaAssetRecord } from '@/server/media-library-records';
import type { MediaReadAccess } from '@/lib/media-read-access';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { extractStorageKeyFromUrl } from '@/server/storage';

/** Uploads include private MCP imports and prepared excerpts; public catalogs stay unchanged. */
export async function createLibraryMediaReadAccess(userId: string, asset: MediaAssetRecord): Promise<MediaReadAccess> {
  if (asset.source !== 'upload' || !extractStorageKeyFromUrl(asset.url)) return {};
  const read = (url: string) => createOwnedMediaReadUrl({ userId, url, expiresInSeconds: 300 });
  const playback = typeof asset.metadata.playbackVideoUrl === 'string' ? asset.metadata.playbackVideoUrl : null;
  const [accessUrl, thumbnailAccessUrl, previewAccessUrl, playbackAccessUrl] = await Promise.all([
    read(asset.url),
    asset.thumbUrl ? read(asset.thumbUrl) : undefined,
    asset.previewUrl ? read(asset.previewUrl) : undefined,
    playback ? read(playback) : undefined,
  ]);
  return { accessUrl, thumbnailAccessUrl, previewAccessUrl, playbackAccessUrl };
}
