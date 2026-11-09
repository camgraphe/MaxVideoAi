import type { MediaReadAccess } from './media-read-access';
/** Stable authenticated navigation preserves the user's original click/popup gesture. */
export function libraryOriginalAccessHref(asset: MediaReadAccess, action: 'original' | 'download', filename?: string): string | null {
  if (!asset.readAccessRef || !asset.readAccessRevision) return null;
  const params = new URLSearchParams({ reference: JSON.stringify(asset.readAccessRef), revision: asset.readAccessRevision, action });
  if (filename) params.set('filename', filename);
  return `/api/media-library/read-access?${params}`;
}
export function mediaReadAccessFields(asset: MediaReadAccess): MediaReadAccess {
  return { accessUrl: asset.accessUrl, thumbnailAccessUrl: asset.thumbnailAccessUrl, previewAccessUrl: asset.previewAccessUrl,
    playbackAccessUrl: asset.playbackAccessUrl, readAccessOwnerId: asset.readAccessOwnerId, readAccessRef: asset.readAccessRef,
    readAccessRevision: asset.readAccessRevision, readAccessExpiresAt: asset.readAccessExpiresAt };
}
