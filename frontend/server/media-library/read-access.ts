import { createHash } from 'node:crypto';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import type { MediaAssetRecord } from '@/server/media-library-records';
import type { MediaReadAccess } from '@/lib/media-read-access';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { extractStorageKeyFromUrl } from '@/server/storage';

export function libraryReadRevision(asset: Pick<MediaAssetRecord, 'url' | 'thumbUrl' | 'previewUrl' | 'metadata'>): string {
  return 'ra_' + createHash('sha256').update(JSON.stringify([asset.url, asset.thumbUrl ?? null, asset.previewUrl ?? null, asset.metadata.playbackVideoUrl ?? null])).digest('hex');
}

export type LibraryReadAsset = Pick<MediaAssetRecord, 'id' | 'publicId' | 'kind' | 'source' | 'url' | 'thumbUrl' | 'previewUrl' | 'metadata'>;

/** Uploads include private MCP imports and prepared excerpts; public catalogs stay unchanged. */
export async function createLibraryMediaReadAccess(userId: string, asset: LibraryReadAsset, reference?: LibraryMediaReference): Promise<MediaReadAccess> {
  if (asset.source !== 'upload' || !extractStorageKeyFromUrl(asset.url)) return {};
  const read = (url: string) => createOwnedMediaReadUrl({ userId, url, expiresInSeconds: 300 });
  const playback = typeof asset.metadata.playbackVideoUrl === 'string' ? asset.metadata.playbackVideoUrl : null;
  const [accessUrl, thumbnailAccessUrl, previewAccessUrl, playbackAccessUrl] = await Promise.all([
    read(asset.url),
    asset.thumbUrl ? read(asset.thumbUrl) : undefined,
    asset.previewUrl ? read(asset.previewUrl) : undefined,
    playback ? read(playback) : undefined,
  ]);
  return { ...libraryMediaReadDescriptor(userId, asset, reference), accessUrl, thumbnailAccessUrl, previewAccessUrl, playbackAccessUrl, readAccessExpiresAt: new Date(Date.now() + 300_000).toISOString() };
}

/** Same canonical descriptor for browse, renewal and successful upload serialization. */
export function libraryMediaReadDescriptor(userId: string, asset: LibraryReadAsset, reference?: LibraryMediaReference): MediaReadAccess {
  if (asset.source !== 'upload' || !extractStorageKeyFromUrl(asset.url)) return {};
  const sourceRef = reference ?? { type: asset.publicId ? 'asset' : 'legacy', assetId: asset.publicId ?? asset.id, kind: asset.kind };
  const readAccessRef: LibraryMediaReference = sourceRef.type === 'job-output'
    ? { type: sourceRef.type, jobId: sourceRef.jobId, outputId: sourceRef.outputId, kind: sourceRef.kind }
    : { type: sourceRef.type, assetId: sourceRef.assetId, kind: sourceRef.kind };
  return { readAccessOwnerId: userId, readAccessRef, readAccessRevision: libraryReadRevision(asset) };
}
