import { cache } from 'react';
import { type SeoWatchVideoConfig, VIDEO_SEO_WATCHLIST } from '@/config/video-seo-watchlist';
import { getSeoVideoById, getSeoVideosByIds, type GalleryVideo } from '@/server/videos';
import {
  deriveWatchPageSignals,
  pickRelatedWatchPages,
  toWatchPageRelatedCandidate,
  type WatchPageDerivedSignals,
  type WatchPageRelatedLink,
} from '@/server/watch-page-signals';

const BASE_WATCH_VIDEOS = [...VIDEO_SEO_WATCHLIST].sort((a, b) => b.priority - a.priority);
const BASE_WATCH_VIDEO_MAP = new Map(BASE_WATCH_VIDEOS.map((entry) => [entry.id, entry] as const));

export type SeoWatchVideoMeta = SeoWatchVideoConfig;
export type SeoWatchVideoRow = {
  entry: SeoWatchVideoMeta;
  video: GalleryVideo | null;
  signals: WatchPageDerivedSignals | null;
  related: WatchPageRelatedLink[];
  isEligible: boolean;
};
export type EligibleSeoWatchVideoRow = {
  entry: SeoWatchVideoMeta;
  video: GalleryVideo;
  signals: WatchPageDerivedSignals;
  related: WatchPageRelatedLink[];
};

export type VideoWatchPageData = {
  entry: SeoWatchVideoMeta | null;
  video: GalleryVideo;
  signals: WatchPageDerivedSignals;
  related: WatchPageRelatedLink[];
  isSelected: boolean;
  isEligible: boolean;
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

const loadSeoWatchVideoRows = cache(async (): Promise<SeoWatchVideoRow[]> => {
  const videoMap = await getSeoVideosByIds(BASE_WATCH_VIDEOS.map((entry) => entry.id));
  const rows = BASE_WATCH_VIDEOS.map((entry) => {
    const video = videoMap.get(entry.id) ?? null;
    const signals = video ? deriveWatchPageSignals({ entry, video }) : null;
    const isEligible = isEligibleSeoWatchVideo(video) && Boolean(signals?.indexable);
    return {
      entry,
      video,
      signals,
      related: [] as WatchPageRelatedLink[],
      isEligible,
    };
  });

  const candidateRows = rows.flatMap((row) => {
    if (!row.isEligible || !row.video || !row.signals) return [];
    return [toWatchPageRelatedCandidate({ entry: row.entry, video: row.video, signals: row.signals })];
  });

  return rows.map((row) => ({
    ...row,
    related:
      row.video && row.signals
        ? pickRelatedWatchPages({
            currentId: row.entry.id,
            currentSignals: row.signals,
            candidates: candidateRows,
            limit: 4,
          })
        : [],
  }));
});

export async function listSeoWatchVideoRows(): Promise<SeoWatchVideoRow[]> {
  return loadSeoWatchVideoRows();
}

export async function listEligibleSeoWatchVideos(): Promise<EligibleSeoWatchVideoRow[]> {
  const rows = await listSeoWatchVideoRows();
  return rows.flatMap((row) => {
    if (!row.isEligible || !row.video || !row.signals) {
      return [];
    }
    return [{ entry: row.entry, video: row.video, signals: row.signals, related: row.related }];
  });
}

export async function getSeoWatchVideoMetaById(id?: string | null): Promise<SeoWatchVideoMeta | null> {
  if (!id) return null;
  return BASE_WATCH_VIDEO_MAP.get(id) ?? null;
}

export async function getSeoWatchVideoRowById(id?: string | null): Promise<SeoWatchVideoRow | null> {
  if (!id) return null;
  const rows = await listSeoWatchVideoRows();
  return rows.find((row) => row.entry.id === id) ?? null;
}

export async function getVideoWatchPageDataById(id: string): Promise<VideoWatchPageData | null> {
  const entry = getBaseSeoWatchVideoMeta(id);
  const video = await getSeoVideoById(id);
  if (!video) return null;

  const signals = deriveWatchPageSignals({ entry, video });
  const selectedRows = await listSeoWatchVideoRows();
  const candidateRows = selectedRows.flatMap((row) => {
    if (!row.isEligible || !row.video || !row.signals) return [];
    return [toWatchPageRelatedCandidate({ entry: row.entry, video: row.video, signals: row.signals })];
  });

  return {
    entry,
    video,
    signals,
    related: pickRelatedWatchPages({
      currentId: id,
      currentSignals: signals,
      candidates: candidateRows,
      limit: 4,
    }),
    isSelected: Boolean(entry),
    isEligible: Boolean(entry) && isEligibleSeoWatchVideo(video) && signals.indexable,
  };
}

export async function getSeoWatchStates(videoIds: string[]): Promise<Map<string, boolean>> {
  const uniqueIds = Array.from(new Set(videoIds.filter(Boolean)));
  if (!uniqueIds.length) {
    return new Map();
  }
  const rows = await listSeoWatchVideoRows();
  const byId = new Map(rows.map((row) => [row.entry.id, row.isEligible] as const));
  return new Map(uniqueIds.map((videoId) => [videoId, byId.get(videoId) ?? false] as const));
}
