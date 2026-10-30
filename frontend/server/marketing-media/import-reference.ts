import { query } from '@/lib/db';
import { createHash } from 'node:crypto';
import { videoDuration } from '@/lib/generated-video-media-facts';
import type { MarketingMediaFile } from '@/lib/marketing-media';
import { downloadReferenceFile } from '@/server/agent-api/reference-file-download';
import { loadPublicKeyframeRecipeForVideo } from '@/server/model-keyframe-demo';
import { getVideoById } from '@/server/videos';
import { storeImageUpload, loadStoredImageUploadRouteAsset } from '@/server/uploads/store-image-upload';
import { storeVideoUpload, storeAudioUpload } from '@/server/uploads/store-media-upload';

const dependencies = { query, downloadReferenceFile, loadPublicKeyframeRecipeForVideo, getVideoById,
  storeImageUpload, loadStoredImageUploadRouteAsset, storeVideoUpload, storeAudioUpload,
  marketingEnabled: () => process.env.MARKETING_MEDIA_ENABLED === '1' };

/** Exact approved source membership precedes bounded downloading and the ordinary measured upload owners. */
export async function importPublicRecipeReference(params: {
  userId: string; videoId: string; url: string; kind: 'image' | 'video' | 'audio'; signal?: AbortSignal;
}, overrides: Partial<typeof dependencies> = {}) {
  const deps = { ...dependencies, ...overrides };
  const authorize = async () => {
    params.signal?.throwIfAborted();
    if (deps.marketingEnabled()) {
      const rows = await deps.query<{ files: MarketingMediaFile[] }>(
        `SELECT files FROM marketing_media WHERE video_id=$1 AND state='ready'
          AND publication->>'visibility'='public' AND files @> $2::jsonb LIMIT 1`,
        [params.videoId, JSON.stringify([{ url: params.url }])],
      );
      const file = rows[0]?.files.find(item => item.url === params.url && item.mime.startsWith(`${params.kind}/`));
      if (file) return file;
    }
    // Only the explicitly reviewed keyframe recipe grants a legacy reference.
    // A public result and its personal settings_snapshot do not grant its inputs.
    if (params.kind === 'image') {
      const video = await deps.getVideoById(params.videoId);
      if (video?.visibility === 'public' && video.indexable && !video.recreationSnapshot) {
        const recipe = await deps.loadPublicKeyframeRecipeForVideo(video.id, video.engineId);
        if (recipe?.jobId === video.id && recipe.keyframes.some(frame => frame.imageUrl === params.url)) return null;
      }
    }
    throw new Error('PUBLIC_REFERENCE_NOT_AVAILABLE');
  };
  const approved = await authorize();
  const file = await deps.downloadReferenceFile({ download_url: params.url, file_id: params.videoId,
    file_name: new URL(params.url).pathname.split('/').at(-1) || undefined });
  if (!file.mimeType.startsWith(`${params.kind}/`)) throw new Error('PUBLIC_REFERENCE_KIND_MISMATCH');
  const current = await authorize(); // Publication revocation during download wins before any owned write.
  for (const manifest of [approved, current]) {
    if (manifest && (file.bytes.length !== manifest.sizeBytes
      || createHash('sha256').update(file.bytes).digest('hex') !== manifest.sha256)) {
      throw new Error('PUBLIC_REFERENCE_CHANGED');
    }
  }
  const verifyStored = async (asset: { id: string; url: string; size: number; mime: string;
    width: number | null; height: number | null; durationSec: number | null; thumbUrl: string | null }) => {
    if (!/^ma_[a-f0-9]{32}$/.test(asset.id)) throw new Error('PUBLIC_REFERENCE_METADATA_UNVERIFIED');
    const rows = await deps.query<{ url: string; kind: string; mime_type: string; size_bytes: number | string;
      width: number | null; height: number | null; metadata: Record<string, unknown> }>(
      `SELECT url,kind,mime_type,size_bytes,width,height,metadata FROM media_assets
        WHERE public_id=$1 AND user_id=$2 AND status='ready' AND deleted_at IS NULL LIMIT 1`,
      [asset.id, params.userId],
    );
    const stored = rows[0];
    const duration = stored && params.kind === 'video' ? videoDuration(stored.metadata ?? {}, stored.url,
      typeof stored.metadata?.durationSec === 'number' ? stored.metadata.durationSec : null)
      : stored?.metadata?.durationSec;
    if (!stored || stored.url !== asset.url || stored.kind !== params.kind || stored.mime_type !== asset.mime
      || Number(stored.size_bytes) !== asset.size || stored.width !== asset.width || stored.height !== asset.height
      || (params.kind !== 'image' && duration !== asset.durationSec)) throw new Error('PUBLIC_REFERENCE_METADATA_UNVERIFIED');
    return asset;
  };
  const upload = { userId: params.userId, bytes: file.bytes, fileName: file.fileName,
    declaredMime: file.mimeType, storageAcl: null, storageCacheControl: 'private, no-store', signal: params.signal };
  if (params.kind === 'image') {
    const stored = await deps.storeImageUpload(upload);
    const image = await deps.loadStoredImageUploadRouteAsset({ userId: params.userId, assetId: stored.assetId });
    return verifyStored({ id: image.canonicalAssetId ?? image.assetId, url: image.url, width: stored.width, height: stored.height,
      mime: stored.mimeType, size: stored.sizeBytes, thumbUrl: image.thumbUrl, durationSec: null });
  }
  const stored = await (params.kind === 'video' ? deps.storeVideoUpload : deps.storeAudioUpload)({
    ...upload, referenceEligibility: 'mcp',
  });
  return verifyStored({ id: stored.assetId, url: stored.storageUrl, width: stored.width, height: stored.height,
    durationSec: stored.durationSec, mime: stored.mimeType, size: stored.sizeBytes, thumbUrl: stored.previewUrl });
}
