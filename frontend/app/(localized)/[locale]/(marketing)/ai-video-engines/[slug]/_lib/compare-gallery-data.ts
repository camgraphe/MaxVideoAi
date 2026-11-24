import { normalizeEngineId } from '@/lib/engine-alias';
import { buildVideoWatchPath } from '@/lib/video-seo-canonical';
import type { GalleryVideo } from '@/server/videos';

export type CompareGalleryVideo = {
  id: string; href: string; engineLabel: string; poster: string; video: string; preview: string | null;
  duration: number;
};

/** Model identity is checked even when a public playlist contains a sibling. */
export function selectCompareGalleryVideos(videos: GalleryVideo[], modelSlug: string, engineId: string): CompareGalleryVideo[] {
  const allowed = new Set([modelSlug, engineId].map(id => normalizeEngineId(id) ?? id));
  const seen = new Set<string>();
  return videos.filter(video => {
    const id = normalizeEngineId(video.engineId) ?? video.engineId;
    if (!allowed.has(id) || video.visibility !== 'public' || !video.indexable || !video.videoUrl || !video.thumbUrl || seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  }).slice(0, 3).map(video => ({
    id: video.id, href: buildVideoWatchPath(video.id), engineLabel: video.engineLabel, poster: video.thumbUrl!,
    video: video.videoUrl!, preview: video.previewVideoUrl ?? null, duration: video.durationSec,
  }));
}
