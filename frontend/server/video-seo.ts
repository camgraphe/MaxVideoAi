import { cache } from 'react';
import { type SeoWatchVideoConfig, VIDEO_SEO_WATCHLIST } from '@/config/video-seo-watchlist';
import type { VideoSeoEditorialEntry, VideoSeoIntent } from '@/config/video-seo-editorial';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { normalizeVideoSeoCanonicalSlug } from '@/lib/video-seo-canonical';
import { getDuplicateVideoObjectNames } from '@/lib/video-seo-editorial-qa';
import {
  listVideoSeoEditorialEntryMap,
  type PersistedVideoSeoEditorialEntry,
} from '@/server/video-seo-editorial';
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
const FALLBACK_PUBLISHED_AT = '1970-01-01T00:00:00.000Z';

export type SeoWatchVideoMeta = SeoWatchVideoConfig;
export type SeoWatchVideoRow = {
  entry: SeoWatchVideoMeta;
  video: GalleryVideo | null;
  editorial: PersistedVideoSeoEditorialEntry | null;
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

function decodeIdentifier(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

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

function toWatchPrimaryIntent(intent?: VideoSeoIntent | null): SeoWatchVideoConfig['videoPrimaryIntent'] {
  if (!intent) return undefined;
  if (intent === 'model-demo') return 'prompt-example';
  return intent;
}

type EditorialMetaSource = VideoSeoEditorialEntry & {
  updatedAt?: string | null;
};

function buildMetaFromEditorial(options: {
  id: string;
  base?: SeoWatchVideoConfig | null;
  editorial?: EditorialMetaSource | null;
  video?: GalleryVideo | null;
}): SeoWatchVideoMeta {
  const { id, base, editorial, video } = options;
  if (!editorial && base) return base;

  const modelSlug = editorial?.modelSlug || base?.engineSlug || normalizeEngineId(video?.engineId ?? '') || video?.engineId || '';
  const examplesSlug = editorial?.examplesSlug || base?.engineFamily || resolveExampleCanonicalSlug(modelSlug) || '';
  const engineLabel = base?.engineLabel || video?.engineLabel || modelSlug || 'AI video engine';
  const sourcePath = examplesSlug ? `/examples/${examplesSlug}` : modelSlug ? `/models/${modelSlug}` : '/examples';
  const sourceLabel = examplesSlug ? `Editorial examples - ${examplesSlug}` : `Editorial model - ${modelSlug || 'video'}`;
  const seoTitle = editorial?.seoTitle || base?.seoTitle || `${engineLabel} video SEO candidate`;

  return {
    id,
    engineSlug: modelSlug,
    engineFamily: examplesSlug || base?.engineFamily || 'video',
    engineLabel,
    sourceType: examplesSlug ? 'examples' : 'models',
    sourcePath,
    sourceLabel,
    seoTitle,
    intro: editorial?.shortDescription || base?.intro || `Editorial video SEO candidate for ${engineLabel}.`,
    reasonForSelection:
      editorial?.seoStatus === 'approved'
        ? 'Approved editorial SEO watch page.'
        : `Editorial SEO status: ${editorial?.seoStatus ?? 'candidate'}.`,
    priority: base?.priority ?? 0,
    publishedAt: base?.publishedAt ?? video?.createdAt ?? FALLBACK_PUBLISHED_AT,
    modifiedAt: editorial?.updatedAt ?? base?.modifiedAt ?? base?.publishedAt ?? video?.createdAt ?? FALLBACK_PUBLISHED_AT,
    watchPageEligible: base?.watchPageEligible,
    videoPrimaryIntent: toWatchPrimaryIntent(editorial?.intent) ?? base?.videoPrimaryIntent,
    exampleFamily: examplesSlug || base?.exampleFamily,
    styleTags: base?.styleTags,
    capabilityTags: base?.capabilityTags,
    seoTitleOverride: base?.seoTitleOverride,
    seoSummaryOverride: base?.seoSummaryOverride,
  };
}

function buildSeoWatchVideoIds(editorialMap: Map<string, PersistedVideoSeoEditorialEntry>): string[] {
  const ids = new Set(BASE_WATCH_VIDEOS.map((entry) => entry.id));
  for (const id of editorialMap.keys()) {
    ids.add(id);
  }
  return [...ids];
}

export async function listSeoWatchVideos(): Promise<SeoWatchVideoMeta[]> {
  const editorialMap = await listVideoSeoEditorialEntryMap();
  return buildSeoWatchVideoIds(editorialMap)
    .map((id) => buildMetaFromEditorial({ id, base: BASE_WATCH_VIDEO_MAP.get(id) ?? null, editorial: editorialMap.get(id) ?? null }))
    .sort((a, b) => b.priority - a.priority);
}

const loadSeoWatchVideoRows = cache(async (): Promise<SeoWatchVideoRow[]> => {
  const editorialMap = await listVideoSeoEditorialEntryMap();
  const ids = buildSeoWatchVideoIds(editorialMap);
  const videoMap = await getSeoVideosByIds(ids);
  const duplicateVideoObjectNames = getDuplicateVideoObjectNames([...editorialMap.values()]);
  const entries = ids.map((id) =>
    buildMetaFromEditorial({
      id,
      base: BASE_WATCH_VIDEO_MAP.get(id) ?? null,
      editorial: editorialMap.get(id) ?? null,
      video: videoMap.get(id) ?? null,
    })
  );
  const rows = entries.map((entry) => {
    const video = videoMap.get(entry.id) ?? null;
    const editorial = editorialMap.get(entry.id) ?? null;
    const signals = video
      ? deriveWatchPageSignals({ entry, video, editorial, duplicateVideoObjectNames })
      : null;
    const isEligible = isEligibleSeoWatchVideo(video) && Boolean(signals?.indexable);
    return {
      entry,
      video,
      editorial,
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
  const entries = await listSeoWatchVideos();
  return entries.find((entry) => entry.id === id) ?? null;
}

export async function getSeoWatchVideoRowById(id?: string | null): Promise<SeoWatchVideoRow | null> {
  if (!id) return null;
  const rows = await listSeoWatchVideoRows();
  return rows.find((row) => row.entry.id === id) ?? null;
}

export async function getVideoWatchPageDataById(id: string): Promise<VideoWatchPageData | null> {
  const selectedRows = await listSeoWatchVideoRows();
  const requestedSlug = normalizeVideoSeoCanonicalSlug(decodeIdentifier(id));
  const selectedRow =
    selectedRows.find((row) => row.entry.id === id || (requestedSlug && row.signals?.canonicalSlug === requestedSlug)) ?? null;
  const resolvedId = selectedRow?.entry.id ?? id;
  const video = selectedRow?.video ?? (await getSeoVideoById(resolvedId));
  if (!video) return null;

  const entry = selectedRow?.entry ?? null;
  const signals = selectedRow?.signals ?? deriveWatchPageSignals({ entry, video });
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
    isSelected: Boolean(selectedRow),
    isEligible: Boolean(selectedRow?.isEligible),
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
