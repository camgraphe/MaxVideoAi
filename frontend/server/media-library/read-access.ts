import { createHash } from 'node:crypto';
import type { LibraryMediaReference } from '@/lib/media-library-organization';
import type { MediaAssetRecord } from '@/server/media-library-records';
import type { MediaReadAccess } from '@/lib/media-read-access';
import { createOwnedMediaReadUrl } from '@/server/owned-media-read-access';
import { extractStorageKeyFromUrl, ownedMediaStorageKeyForUrl } from '@/server/storage';

export function libraryReadRevision(asset: Pick<MediaAssetRecord, 'url' | 'thumbUrl' | 'previewUrl' | 'metadata'>): string {
  return 'ra_' + createHash('sha256').update(JSON.stringify([asset.url, asset.thumbUrl ?? null, asset.previewUrl ?? null, asset.metadata.playbackVideoUrl ?? null])).digest('hex');
}

export type LibraryReadAsset = Pick<MediaAssetRecord, 'id' | 'publicId' | 'kind' | 'source' | 'url' | 'thumbUrl' | 'previewUrl' | 'metadata'>;

function canGrantLibraryRead(userId: string, asset: LibraryReadAsset): boolean {
  if (asset.source === 'upload') return !!extractStorageKeyFromUrl(asset.url);
  return asset.source === 'saved_job_output' && !!ownedMediaStorageKeyForUrl({ userId, url: asset.url });
}

/** The authenticated library can deliver private uploads and owned generation files. */
export async function createLibraryMediaReadAccess(userId: string, asset: LibraryReadAsset, reference?: LibraryMediaReference): Promise<MediaReadAccess> {
  const descriptor = libraryMediaReadDescriptor(userId, asset, reference);
  if (!descriptor.readAccessRef) return {};
  const read = (url: string) => createOwnedMediaReadUrl({ userId, url, expiresInSeconds: 300 });
  const readVariant = (url: string | null | undefined) =>
    url && (asset.source === 'upload' || ownedMediaStorageKeyForUrl({ userId, url })) ? read(url) : undefined;
  const playback = typeof asset.metadata.playbackVideoUrl === 'string' ? asset.metadata.playbackVideoUrl : null;
  const [accessUrl, thumbnailAccessUrl, previewAccessUrl, playbackAccessUrl] = await Promise.all([
    read(asset.url),
    readVariant(asset.thumbUrl),
    readVariant(asset.previewUrl),
    readVariant(playback),
  ]);
  return { ...descriptor, accessUrl, thumbnailAccessUrl, previewAccessUrl, playbackAccessUrl, readAccessExpiresAt: new Date(Date.now() + 300_000).toISOString() };
}

/** Same canonical descriptor for browse, renewal and successful upload serialization. */
export function libraryMediaReadDescriptor(userId: string, asset: LibraryReadAsset, reference?: LibraryMediaReference): MediaReadAccess {
  if (!canGrantLibraryRead(userId, asset)) return {};
  const sourceRef = reference ?? { type: asset.publicId ? 'asset' : 'legacy', assetId: asset.publicId ?? asset.id, kind: asset.kind };
  const readAccessRef: LibraryMediaReference = sourceRef.type === 'job-output'
    ? { type: sourceRef.type, jobId: sourceRef.jobId, outputId: sourceRef.outputId, kind: sourceRef.kind }
    : { type: sourceRef.type, assetId: sourceRef.assetId, kind: sourceRef.kind };
  return { readAccessOwnerId: userId, readAccessRef, readAccessRevision: libraryReadRevision(asset) };
}
