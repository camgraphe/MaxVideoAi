import { type SeoWatchVideoConfig, VIDEO_SEO_WATCHLIST } from '@/config/video-seo-watchlist';

const BASE_WATCH_VIDEOS = [...VIDEO_SEO_WATCHLIST].sort((a, b) => b.priority - a.priority);
const BASE_WATCH_VIDEO_MAP = new Map(BASE_WATCH_VIDEOS.map((entry) => [entry.id, entry] as const));

export type SeoWatchVideoMeta = SeoWatchVideoConfig;

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

export async function getSeoWatchVideoMetaById(id?: string | null): Promise<SeoWatchVideoMeta | null> {
  if (!id) return null;
  return BASE_WATCH_VIDEO_MAP.get(id) ?? null;
}

export async function getSeoWatchStates(videoIds: string[]): Promise<Map<string, boolean>> {
  const uniqueIds = Array.from(new Set(videoIds.filter(Boolean)));
  return new Map(uniqueIds.map((videoId) => [videoId, BASE_WATCH_VIDEO_MAP.has(videoId)] as const));
}
