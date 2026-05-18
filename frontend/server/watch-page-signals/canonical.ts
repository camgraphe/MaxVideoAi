import { buildExpectedVideoCanonicalUrl, validateVideoSeoCanonical } from '@/lib/video-seo-canonical';
import type { GalleryVideo } from '@/server/videos';

export function buildWatchPageCanonicalState(params: {
  video: GalleryVideo;
  stableVideoAsset: boolean;
  stableThumbnailAsset: boolean;
  hasInternalLinkTargets: boolean;
}) {
  const { video, stableVideoAsset, stableThumbnailAsset, hasInternalLinkTargets } = params;
  const canonicalUrl = buildExpectedVideoCanonicalUrl(video.id);
  const canonicalTargetIndexable = Boolean(
    video.videoUrl &&
      video.thumbUrl &&
      video.visibility === 'public' &&
      video.indexable &&
      stableVideoAsset &&
      stableThumbnailAsset &&
      hasInternalLinkTargets
  );
  const validation = validateVideoSeoCanonical({
    videoId: video.id,
    canonicalUrl,
    expectedCanonicalUrl: canonicalUrl,
    canonicalTargetIndexable,
  });

  return {
    canonicalUrl,
    canonicalTargetIndexable,
    validation,
  };
}
