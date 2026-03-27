import { type SeoWatchVideoConfig, VIDEO_SEO_WATCHLIST } from '@/config/video-seo-watchlist';
import { getVideosByIds, type GalleryVideo } from '@/server/videos';

const BASE_WATCH_VIDEOS = [...VIDEO_SEO_WATCHLIST].sort((a, b) => b.priority - a.priority);
const BASE_WATCH_VIDEO_MAP = new Map(BASE_WATCH_VIDEOS.map((entry) => [entry.id, entry] as const));

export type SeoWatchVideoMeta = SeoWatchVideoConfig;
export type SeoWatchVideoRow = {
  entry: SeoWatchVideoMeta;
  video: GalleryVideo | null;
  isEligible: boolean;
};
export type EligibleSeoWatchVideoRow = {
  entry: SeoWatchVideoMeta;
  video: GalleryVideo;
};

function isEligibleSeoWatchVideo(video: GalleryVideo | null): video is GalleryVideo {
  if (!video) return false;
  if (video.visibility !== 'public') return false;
  if (!video.indexable) return false;
  if (!video.videoUrl) return false;
  return true;
}

export function getBaseSeoWatchVideos(): readonly SeoWatchVideoMeta[] {
  return BASE_WATCH_VIDEOS;
}

export function getBaseSeoWatchVideoMeta(id?: string | null): SeoWatchVideoMeta | null {
  if (!id) return null;
  return BASE_WATCH_VIDEO_MAP.get(id) ?? null;
}

export async function listSeoWatchVideos(): Promise<SeoWatchVideoMeta[]> {
  return [...BASE_WATCH_VIDEOS];
}

export async function listSeoWatchVideoRows(): Promise<SeoWatchVideoRow[]> {
  const videoMap = await getVideosByIds(BASE_WATCH_VIDEOS.map((entry) => entry.id));
  return BASE_WATCH_VIDEOS.map((entry) => {
    const video = videoMap.get(entry.id) ?? null;
    return {
      entry,
      video,
      isEligible: isEligibleSeoWatchVideo(video),
    };
  });
}

export async function listEligibleSeoWatchVideos(): Promise<EligibleSeoWatchVideoRow[]> {
  const rows = await listSeoWatchVideoRows();
  return rows.flatMap((row) => {
    if (!row.isEligible || !row.video) {
      return [];
    }
    return [{ entry: row.entry, video: row.video }];
  });
}

export async function getSeoWatchVideoMetaById(id?: string | null): Promise<SeoWatchVideoMeta | null> {
  if (!id) return null;
  return BASE_WATCH_VIDEO_MAP.get(id) ?? null;
}

export async function getSeoWatchStates(videoIds: string[]): Promise<Map<string, boolean>> {
  const uniqueIds = Array.from(new Set(videoIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }
  const videoMap = await getVideosByIds(uniqueIds);
  return new Map(uniqueIds.map((videoId) => [videoId, isEligibleSeoWatchVideo(videoMap.get(videoId) ?? null)] as const));
}
