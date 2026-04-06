import { query } from '@/lib/db';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { normalizeMediaUrl } from '@/lib/media';
import { getExampleFamilyEngineAliases } from '@/lib/model-families';
import { removeVideosFromIndexablePlaylists } from '@/server/indexing';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs, getStarterPlaylistSlug } from '@/server/playlists';
import type { PricingSnapshot } from '@/types/engines';

type VideoRow = {
  job_id: string;
  user_id: string | null;
  engine_id: string;
  engine_label: string;
  duration_sec: number;
  prompt: string;
  thumb_url: string;
  video_url: string | null;
  aspect_ratio: string | null;
  has_audio: boolean | null;
  can_upscale: boolean | null;
  created_at: string;
  visibility: string;
  indexable: boolean | null;
  featured: boolean | null;
  featured_order: number | null;
  final_price_cents: number | null;
  currency: string | null;
  pricing_snapshot: PricingSnapshot | null;
  settings_snapshot?: unknown;
  order_index?: number | null;
};

export type GalleryVideo = {
  id: string;
  userId: string | null;
  engineId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  promptExcerpt: string;
  thumbUrl?: string;
  videoUrl?: string;
  aspectRatio?: string;
  createdAt: string;
  visibility: 'public' | 'private';
  indexable: boolean;
  hasAudio: boolean;
  canUpscale: boolean;
  finalPriceCents?: number | null;
  currency?: string | null;
  pricingSnapshot?: PricingSnapshot;
  settingsSnapshot?: unknown;
  playlistOrder?: number | null;
};

function formatPromptExcerpt(prompt: string, maxLength = 160): string {
  const trimmed = prompt.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

function mapRow(row: VideoRow): GalleryVideo {
  return {
    id: row.job_id,
    userId: row.user_id ?? null,
    engineId: row.engine_id,
    engineLabel: row.engine_label,
    durationSec: row.duration_sec,
    prompt: row.prompt,
    promptExcerpt: formatPromptExcerpt(row.prompt),
    thumbUrl: normalizeMediaUrl(row.thumb_url) ?? undefined,
    videoUrl: row.video_url ? normalizeMediaUrl(row.video_url) ?? undefined : undefined,
    aspectRatio: row.aspect_ratio ?? undefined,
    createdAt: row.created_at,
    visibility: (row.visibility ?? 'public') === 'private' ? 'private' : 'public',
    indexable: Boolean(row.indexable ?? true),
    hasAudio: Boolean(row.has_audio ?? false),
    canUpscale: Boolean(row.can_upscale ?? false),
    finalPriceCents: row.final_price_cents ?? undefined,
    currency: row.currency ?? undefined,
    pricingSnapshot: row.pricing_snapshot ?? undefined,
    settingsSnapshot: row.settings_snapshot ?? undefined,
    playlistOrder: typeof row.order_index === 'number' ? row.order_index : null,
  };
}

export type GalleryTab = 'starter' | 'latest' | 'trending';

const BASE_SELECT = `
  SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url,
         aspect_ratio, has_audio, can_upscale, created_at, visibility, indexable, featured, featured_order,
         final_price_cents, currency, pricing_snapshot
  FROM app_jobs
`;

const BASE_SELECT_WITH_SETTINGS = `
  SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url,
         aspect_ratio, has_audio, can_upscale, created_at, visibility, indexable, featured, featured_order,
         final_price_cents, currency, pricing_snapshot, settings_snapshot
  FROM app_jobs
`;

const PUBLIC_VIDEO_PREDICATE = `
  visibility = 'public'
  AND COALESCE(indexable, TRUE)
`;

const PUBLIC_VIDEO_PREDICATE_PLAYLIST = `
  aj.visibility = 'public'
  AND COALESCE(aj.indexable, TRUE)
`;

export async function getVideoById(videoId: string): Promise<GalleryVideo | null> {
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id = $1 LIMIT 1`,
    [videoId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getSeoVideoById(videoId: string): Promise<GalleryVideo | null> {
  const rows = await query<VideoRow>(
    `${BASE_SELECT_WITH_SETTINGS} WHERE job_id = $1 AND ${PUBLIC_VIDEO_PREDICATE} LIMIT 1`,
    [videoId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getVideosByIds(videoIds: string[]): Promise<Map<string, GalleryVideo>> {
  if (!videoIds.length) {
    return new Map();
  }
  const uniqueIds = Array.from(new Set(videoIds));
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id = ANY($1::text[])`,
    [uniqueIds]
  );
  const map = new Map<string, GalleryVideo>();
  rows.forEach((row) => {
    map.set(row.job_id, mapRow(row));
  });
  return map;
}

export async function getSeoVideosByIds(videoIds: string[]): Promise<Map<string, GalleryVideo>> {
  if (!videoIds.length) {
    return new Map();
  }
  const uniqueIds = Array.from(new Set(videoIds));
  const rows = await query<VideoRow>(
    `${BASE_SELECT_WITH_SETTINGS} WHERE job_id = ANY($1::text[]) AND ${PUBLIC_VIDEO_PREDICATE}`,
    [uniqueIds]
  );
  const map = new Map<string, GalleryVideo>();
  rows.forEach((row) => {
    map.set(row.job_id, mapRow(row));
  });
  return map;
}

export async function getPublicVideosByIds(videoIds: string[]): Promise<Map<string, GalleryVideo>> {
  if (!videoIds.length) {
    return new Map();
  }
  const uniqueIds = Array.from(new Set(videoIds));
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id = ANY($1::text[]) AND ${PUBLIC_VIDEO_PREDICATE}`,
    [uniqueIds]
  );
  const map = new Map<string, GalleryVideo>();
  rows.forEach((row) => {
    map.set(row.job_id, mapRow(row));
  });
  return map;
}

export async function getLatestVideoByPromptAndEngine(
  prompt: string,
  engineId: string
): Promise<GalleryVideo | null> {
  const rows = await query<VideoRow>(
    `
      ${BASE_SELECT}
      WHERE prompt = $1
        AND engine_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [prompt, engineId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getLatestPublicVideoByPromptAndEngine(
  prompt: string,
  engineId: string
): Promise<GalleryVideo | null> {
  const rows = await query<VideoRow>(
    `
      ${BASE_SELECT}
      WHERE prompt = $1
        AND engine_id = $2
        AND ${PUBLIC_VIDEO_PREDICATE}
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [prompt, engineId]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

type PlaylistVideoQueryOptions = {
  slug: string;
  limit?: number;
  engineAliases?: string[] | null;
};

async function listPlaylistVideosWithOptions({
  slug,
  limit,
  engineAliases,
}: PlaylistVideoQueryOptions): Promise<GalleryVideo[]> {
  const params: unknown[] = [slug];
  const aliasFilter =
    Array.isArray(engineAliases) && engineAliases.length
      ? (() => {
          params.push(engineAliases.map((value) => value.trim().toLowerCase()).filter(Boolean));
          return `AND LOWER(aj.engine_id) = ANY($${params.length}::text[])`;
        })()
      : '';
  const limitClause =
    typeof limit === 'number'
      ? (() => {
          params.push(limit);
          return `LIMIT $${params.length}`;
        })()
      : '';

  const rows = await query<VideoRow & { order_index: number }>(
    `
      SELECT aj.job_id, aj.user_id, aj.engine_id, aj.engine_label, aj.duration_sec, aj.prompt, aj.thumb_url,
             aj.video_url, aj.aspect_ratio, aj.has_audio, aj.can_upscale, aj.created_at, aj.visibility,
             aj.indexable, aj.featured, aj.featured_order, aj.final_price_cents, aj.currency, aj.pricing_snapshot, pi.order_index
      FROM playlists p
      JOIN playlist_items pi ON pi.playlist_id = p.id
      JOIN app_jobs aj ON aj.job_id = pi.video_id
      WHERE p.slug = $1
        AND p.is_public = TRUE
        AND ${PUBLIC_VIDEO_PREDICATE_PLAYLIST}
        ${aliasFilter}
      ORDER BY
        CASE WHEN pi.order_index IS NULL THEN 1 ELSE 0 END,
        pi.order_index DESC,
        aj.created_at DESC
      ${limitClause}
    `,
    params
  );
  return rows.map(mapRow);
}

export async function listPlaylistVideos(slug: string, limit: number): Promise<GalleryVideo[]> {
  return listPlaylistVideosWithOptions({ slug, limit });
}

async function listAllPlaylistVideos(slug: string): Promise<GalleryVideo[]> {
  return listPlaylistVideosWithOptions({ slug });
}

async function listLatest(limit: number): Promise<GalleryVideo[]> {
  const rows = await query<VideoRow>(
    `
      ${BASE_SELECT}
      WHERE ${PUBLIC_VIDEO_PREDICATE}
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return rows.map(mapRow);
}

async function listTrending(limit: number): Promise<GalleryVideo[]> {
  const rows = await query<VideoRow>(
    `
      ${BASE_SELECT}
      WHERE ${PUBLIC_VIDEO_PREDICATE}
      ORDER BY featured DESC, featured_order ASC, created_at DESC
      LIMIT $1
    `,
    [limit]
  );
  return rows.map(mapRow);
}

export async function listGalleryVideos(tab: GalleryTab, limit = 24): Promise<GalleryVideo[]> {
  if (tab === 'starter') {
    const playlist = await listPlaylistVideos(getStarterPlaylistSlug(), limit);
    if (playlist.length) {
      return playlist;
    }
    return listLatest(limit);
  }
  if (tab === 'trending') {
    return listTrending(limit);
  }
  return listLatest(limit);
}

export async function listStarterPlaylistVideos(limit: number): Promise<GalleryVideo[]> {
  return listPlaylistVideos(getStarterPlaylistSlug(), limit);
}

export type ExampleSort = 'playlist' | 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc' | 'engine-asc';

export type ListExamplesPageOptions = {
  sort: ExampleSort;
  limit?: number;
  offset?: number;
  engineGroup?: string | null;
};

export type ListExamplesPageResult = {
  items: GalleryVideo[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const ENGINE_GROUP_FETCH_MULTIPLIER = 4;
const ENGINE_GROUP_FETCH_CAP = 400;

function resolveExampleGroupId(engineId: string | null | undefined): string | null {
  if (!engineId) return null;
  const normalized = (normalizeEngineId(engineId) ?? engineId).trim().toLowerCase();
  if (!normalized) return null;
  return resolveExampleCanonicalSlug(normalized) ?? normalized;
}

function sortVideosByPreference(videos: GalleryVideo[], sort: ExampleSort): GalleryVideo[] {
  if (sort === 'playlist') {
    return [...videos];
  }
  const copy = [...videos];
  switch (sort) {
    case 'date-asc':
      return copy.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    case 'duration-asc':
      return copy.sort((a, b) => (a.durationSec ?? 0) - (b.durationSec ?? 0));
    case 'duration-desc':
      return copy.sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0));
    case 'engine-asc':
      return copy.sort(
        (a, b) => (a.engineLabel ?? '').localeCompare(b.engineLabel ?? '') || Date.parse(b.createdAt) - Date.parse(a.createdAt)
      );
    case 'date-desc':
    default:
      return copy.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }
}

export function mergeUniqueGalleryVideos(...groups: GalleryVideo[][]): GalleryVideo[] {
  const seen = new Set<string>();
  const merged: GalleryVideo[] = [];
  groups.forEach((videos) => {
    videos.forEach((video) => {
      if (seen.has(video.id)) return;
      seen.add(video.id);
      merged.push(video);
    });
  });
  return merged;
}

function paginateGalleryVideos(videos: GalleryVideo[], limit: number, offset: number): ListExamplesPageResult {
  const total = videos.length;
  const start = Math.max(0, offset);
  const items = videos.slice(start, start + limit);
  return {
    items,
    total,
    limit,
    offset: start,
    hasMore: start + items.length < total,
  };
}

async function loadExampleFamilyFeed(
  familyId: string,
  options?: { includeFamilyPlaylist?: boolean }
): Promise<GalleryVideo[]> {
  const includeFamilyPlaylist = options?.includeFamilyPlaylist ?? true;
  const sourceSlugs = getFamilyFeedSourceSlugs(familyId);
  if (!sourceSlugs.length) {
    return [];
  }

  const [familySlug, ...rest] = sourceSlugs;
  const hubSlug = rest.pop() ?? getExamplesHubPlaylistSlug();
  const modelSlugs = rest;
  const engineAliases = getExampleFamilyEngineAliases(familyId);

  const familyVideosPromise =
    includeFamilyPlaylist && familySlug ? listAllPlaylistVideos(familySlug).catch(() => [] as GalleryVideo[]) : Promise.resolve([]);
  const modelVideosPromise = Promise.all(
    modelSlugs.map(async (slug) => listAllPlaylistVideos(slug).catch(() => [] as GalleryVideo[]))
  );
  const hubVideosPromise =
    hubSlug && engineAliases.length
      ? listPlaylistVideosWithOptions({ slug: hubSlug, engineAliases }).catch(() => [] as GalleryVideo[])
      : Promise.resolve([] as GalleryVideo[]);

  const [familyVideos, modelVideos, hubVideos] = await Promise.all([
    familyVideosPromise,
    modelVideosPromise,
    hubVideosPromise,
  ]);

  return mergeUniqueGalleryVideos(familyVideos, ...modelVideos, hubVideos);
}

export async function listExampleFamilyAutoFeed(familyId: string): Promise<GalleryVideo[]> {
  return loadExampleFamilyFeed(familyId, { includeFamilyPlaylist: false });
}

export async function listExampleFamilyPage(
  familyId: string,
  options: Omit<ListExamplesPageOptions, 'engineGroup'>
): Promise<ListExamplesPageResult> {
  const { sort, limit = 150, offset = 0 } = options;
  const merged = await loadExampleFamilyFeed(familyId, { includeFamilyPlaylist: true });
  const sorted = sortVideosByPreference(merged, sort);
  return paginateGalleryVideos(sorted, limit, offset);
}

export async function listExamplesPage(options: ListExamplesPageOptions): Promise<ListExamplesPageResult> {
  const { sort, limit = 150, offset = 0, engineGroup } = options;
  const hubSlug = getExamplesHubPlaylistSlug();
  if (!hubSlug) {
    return { items: [], total: 0, limit, offset, hasMore: false };
  }

  const normalizedGroup = engineGroup ? engineGroup.trim().toLowerCase() : null;
  const baseFetchLimit = Math.max(limit + Math.max(offset, 0), limit);
  const playlistFetchLimit = normalizedGroup
    ? Math.min(baseFetchLimit * ENGINE_GROUP_FETCH_MULTIPLIER, ENGINE_GROUP_FETCH_CAP)
    : baseFetchLimit;

  const aggregated = await listPlaylistVideos(hubSlug, playlistFetchLimit).catch((error) => {
    console.warn(`[examples] failed to load playlist "${hubSlug}"`, error);
    return [] as GalleryVideo[];
  });

  if (!aggregated.length) {
    return { items: [], total: 0, limit, offset, hasMore: false };
  }

  const candidates = normalizedGroup
    ? aggregated.filter((video) => resolveExampleGroupId(video.engineId) === normalizedGroup)
    : aggregated;
  const sorted = sortVideosByPreference(candidates, sort);
  return paginateGalleryVideos(sorted, limit, offset);
}

export async function listExamples(sort: ExampleSort, limit = 150): Promise<GalleryVideo[]> {
  const result = await listExamplesPage({ sort, limit, offset: 0 });
  return result.items;
}

export async function getPlaylistExamples(limit = 60): Promise<GalleryVideo[]> {
  const hubSlug = getExamplesHubPlaylistSlug();
  if (!hubSlug) {
    return [];
  }
  return listPlaylistVideos(hubSlug, limit);
}

export async function updateVideoIndexableForUser(
  videoId: string,
  userId: string,
  indexable: boolean
): Promise<boolean> {
  const rows = await query<{ job_id: string; indexable: boolean | null }>(
    `UPDATE app_jobs
       SET indexable = $1,
           updated_at = NOW()
     WHERE job_id = $2
       AND user_id = $3
     RETURNING job_id, indexable`,
    [indexable, videoId, userId]
  );
  const updated = rows[0];
  if (!updated) {
    return false;
  }
  if (updated.indexable === false) {
    await removeVideosFromIndexablePlaylists([updated.job_id]);
  }
  return true;
}
