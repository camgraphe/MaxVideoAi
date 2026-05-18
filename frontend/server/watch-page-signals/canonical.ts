import { buildExpectedVideoCanonicalUrl, validateVideoSeoCanonical } from '@/lib/video-seo-canonical';
import type { GalleryVideo } from '@/server/videos';

export function buildWatchPageCanonicalState(params: {
  video: GalleryVideo;
  canonicalSlug?: string | null;
  stableVideoAsset: boolean;
  stableThumbnailAsset: boolean;
  hasInternalLinkTargets: boolean;
}) {
  const { video, canonicalSlug, stableVideoAsset, stableThumbnailAsset, hasInternalLinkTargets } = params;
  const canonicalUrl = buildExpectedVideoCanonicalUrl(video.id, canonicalSlug);
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
