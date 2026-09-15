import { normalizeEngineId } from '@/lib/engine-alias';
import type { GalleryVideo } from '@/server/videos';

export type CompareGalleryVideo = {
  id: string; poster: string; video: string; preview: string | null;
  duration: number; aspectRatio: string; hasAudio: boolean;
};

/** Model identity is checked even when a public playlist contains a sibling. */
export function selectCompareGalleryVideos(videos: GalleryVideo[], modelSlug: string, engineId: string): CompareGalleryVideo[] {
  const allowed = new Set([modelSlug, engineId].map(id => normalizeEngineId(id) ?? id));
  const seen = new Set<string>();
  return videos.filter(video => {
    const id = normalizeEngineId(video.engineId) ?? video.engineId;
    if (!allowed.has(id) || video.visibility !== 'public' || !video.videoUrl || !video.thumbUrl || seen.has(video.id)) return false;
    seen.add(video.id);
    return true;
  }).slice(0, 3).map(video => ({
    id: video.id, poster: video.thumbUrl!, video: video.videoUrl!, preview: video.previewVideoUrl ?? null,
    duration: video.durationSec, aspectRatio: video.aspectRatio ?? '16:9', hasAudio: video.hasAudio,
  }));
}
