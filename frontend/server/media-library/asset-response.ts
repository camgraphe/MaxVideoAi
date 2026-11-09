import { imageDisplayFields } from '@/lib/image-display';
import { canonicalMediaAssetFields, readMediaFacts } from '@/lib/media-identity';
import type { MediaAssetRecord } from '../media-library-records';
import type { MediaReadAccess } from '@/lib/media-read-access';
import { privateMediaAssetName } from './private-asset-name';
/** Pure DTO projection: no identity lookup or storage work hidden inside serialization. */
export function serializeLibraryAsset(asset: MediaAssetRecord, access: MediaReadAccess = {}) {
    return { id: asset.id, name: privateMediaAssetName(asset.metadata), ...canonicalMediaAssetFields(asset.publicId, asset.kind),
        mediaFacts: readMediaFacts(asset.metadata.mediaFacts), url: asset.url, thumbUrl: asset.thumbUrl, previewUrl: asset.previewUrl, ...(asset.kind === 'image' ? imageDisplayFields(asset.metadata.imageDisplay, asset.url, asset.previewUrl) : {}), ...access,
        playbackVideoUrl: typeof asset.metadata.playbackVideoUrl === 'string' ? asset.metadata.playbackVideoUrl : undefined,
        mime: asset.mimeType, width: asset.width, height: asset.height, size: asset.sizeBytes, durationSec: asset.durationSec, kind: asset.kind,
        source: asset.source, jobId: asset.sourceJobId, sourceOutputId: asset.sourceOutputId, createdAt: asset.createdAt };
}
