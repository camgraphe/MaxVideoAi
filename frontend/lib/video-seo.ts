import { VIDEO_SEO_WATCHLIST, type SeoWatchVideoConfig } from '@/config/video-seo-watchlist';

const WATCH_VIDEOS = [...VIDEO_SEO_WATCHLIST].sort((a, b) => b.priority - a.priority);
const WATCH_VIDEO_MAP = new Map(WATCH_VIDEOS.map((entry) => [entry.id, entry] as const));
const VIDEO_PATH_PATTERN = /^\/video\/([^/?#]+)$/i;

export type SeoWatchVideoMeta = SeoWatchVideoConfig;

export function getSeoWatchVideos(): readonly SeoWatchVideoMeta[] {
  return WATCH_VIDEOS;
}

export function getSeoWatchVideoMeta(id?: string | null): SeoWatchVideoMeta | null {
  if (!id) return null;
  return WATCH_VIDEO_MAP.get(id) ?? null;
}

export function isSeoWatchVideo(id?: string | null): boolean {
  return Boolean(getSeoWatchVideoMeta(id));
}

export function getSeoWatchVideosForEngine(options: {
  engineSlug?: string | null;
  engineFamily?: string | null;
  limit?: number;
}): SeoWatchVideoMeta[] {
  const normalizedSlug = options.engineSlug?.trim().toLowerCase() ?? null;
  const normalizedFamily = options.engineFamily?.trim().toLowerCase() ?? null;
  const limit = Math.max(1, options.limit ?? 3);

  const exactMatches = normalizedSlug
    ? WATCH_VIDEOS.filter((entry) => entry.engineSlug.toLowerCase() === normalizedSlug)
    : [];

  if (exactMatches.length >= limit) {
    return exactMatches.slice(0, limit);
  }

  const familyMatches = normalizedFamily
    ? WATCH_VIDEOS.filter(
        (entry) =>
          entry.engineFamily.toLowerCase() === normalizedFamily &&
          !exactMatches.some((match) => match.id === entry.id)
      )
    : [];

  return [...exactMatches, ...familyMatches].slice(0, limit);
}

export function extractSeoWatchVideoIdFromPath(path?: string | null): string | null {
  if (!path) return null;
  const match = path.match(VIDEO_PATH_PATTERN);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1] ?? '');
  } catch {
    return match[1] ?? null;
  }
}

export function isSeoWatchVideoPath(path?: string | null): boolean {
  return isSeoWatchVideo(extractSeoWatchVideoIdFromPath(path));
}
