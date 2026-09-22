import { listPlaylistVideosWithOptions, listCuratedGalleryVideos } from './videos-playlists';
import { BASE_SELECT, BASE_SELECT_WITH_SETTINGS } from './videos-query';
import { getLocalPublicExample, isLocalPublicExamplesEnabled, listLocalPublicExamples } from './local-public-examples';
import { query } from '@/lib/db';
import { getDiscoverableExampleEngineAliases } from '@/lib/examples/discovery';
import { getExampleFamilyEngineAliases } from '@/lib/model-families';
import { removeVideosFromIndexablePlaylists } from '@/server/indexing';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs, getStarterPlaylistSlug } from '@/server/playlists';
import {
  listExampleFamilyCurrentPublicOrderFromSources,
  listExampleModelCurrentPublicOrderFromSources,
} from './videos-current-order';
import {
  ENGINE_GROUP_FETCH_CAP,
  ENGINE_GROUP_FETCH_MULTIPLIER,
  mergeUniqueGalleryVideos,
  paginateGalleryVideos,
  resolveExampleGroupId,
  sortVideosByPreference,
  type ExampleSort,
  type ListExamplesPageOptions,
  type ListExamplesPageResult,
} from './videos-examples';
import { mapGalleryVideoRow, type GalleryVideo, type VideoRow } from './videos-normalization';
export type { ExampleSort, ListExamplesPageOptions, ListExamplesPageResult } from './videos-examples';
export type { GalleryVideo } from './videos-normalization';
export { mergeUniqueGalleryVideos } from './videos-examples';
export type GalleryTab = 'starter' | 'latest' | 'trending';
function shouldSkipBuildTimeMarketingVideoQueries() { return process.env.NEXT_PHASE === 'phase-production-build'; }
const PUBLIC_VIDEO_PREDICATE = `
  visibility = 'public'
  AND COALESCE(indexable, TRUE)
`;


export async function getVideoById(videoId: string): Promise<GalleryVideo | null> {
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id = $1 LIMIT 1`,
    [videoId]
  );
  return rows[0] ? mapGalleryVideoRow(rows[0]) : null;
}

export async function getSeoVideoById(videoId: string): Promise<GalleryVideo | null> {
  const rows = await query<VideoRow>(
    `${BASE_SELECT_WITH_SETTINGS} WHERE job_id = $1 AND ${PUBLIC_VIDEO_PREDICATE} LIMIT 1`,
    [videoId]
  );
  return rows[0] ? mapGalleryVideoRow(rows[0]) : null;
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
  return new Map(rows.map((row) => [row.job_id, mapGalleryVideoRow(row)]));
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
  return new Map(rows.map((row) => [row.job_id, mapGalleryVideoRow(row)]));
}

export async function getPublicVideosByIds(videoIds: string[]): Promise<Map<string, GalleryVideo>> {
  if (isLocalPublicExamplesEnabled()) {
    return new Map(videoIds.flatMap(id => {
      const video = getLocalPublicExample(id);
      return video ? [[id, video] as const] : [];
    }));
  }
  if (shouldSkipBuildTimeMarketingVideoQueries()) return new Map();
  if (!videoIds.length) {
    return new Map();
  }
  const uniqueIds = Array.from(new Set(videoIds));
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id = ANY($1::text[]) AND ${PUBLIC_VIDEO_PREDICATE}`,
    [uniqueIds]
  );
  return new Map(rows.map((row) => [row.job_id, mapGalleryVideoRow(row)]));
}

export async function listPublicVideoPagesForSeoAudit(limit = 1000): Promise<GalleryVideo[]> {
  const safeLimit = Math.max(1, Math.min(5000, Math.floor(limit)));
  const rows = await query<VideoRow>(
    `${BASE_SELECT_WITH_SETTINGS} WHERE visibility = 'public' ORDER BY created_at DESC LIMIT $1`,
    [safeLimit]
  );
  return rows.map(mapGalleryVideoRow);
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
  return rows[0] ? mapGalleryVideoRow(rows[0]) : null;
}

export async function getLatestPublicVideoByPromptAndEngine(
  prompt: string,
  engineId: string
): Promise<GalleryVideo | null> {
  if (shouldSkipBuildTimeMarketingVideoQueries()) return null;
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
  return rows[0] ? mapGalleryVideoRow(rows[0]) : null;
}

export async function listPlaylistVideos(slug: string, limit: number): Promise<GalleryVideo[]> {
  if (shouldSkipBuildTimeMarketingVideoQueries()) return [];
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
  return rows.map(mapGalleryVideoRow);
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
  return rows.map(mapGalleryVideoRow);
}

export async function listGalleryVideos(tab: GalleryTab, limit = 24): Promise<GalleryVideo[]> {
  if (shouldSkipBuildTimeMarketingVideoQueries()) return [];
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
  if (shouldSkipBuildTimeMarketingVideoQueries()) return [];
  return listPlaylistVideos(getStarterPlaylistSlug(), limit);
}

async function loadExampleFamilyFeed(
  familyId: string,
  options?: { includeFamilyPlaylist?: boolean }
): Promise<GalleryVideo[]> {
  const includeFamilyPlaylist = options?.includeFamilyPlaylist ?? true;
  if (includeFamilyPlaylist) {
    const curated = await listCuratedGalleryVideos(`family-${familyId}`);
    if (curated !== null) return curated;
  }
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

export async function listExampleFamilyCurrentPublicOrder(familyId: string): Promise<GalleryVideo[]> {
  return listExampleFamilyCurrentPublicOrderFromSources({ familyId, listAllPlaylistVideos });
}

export async function listExampleModelCurrentPublicOrder(modelSlug: string): Promise<GalleryVideo[]> {
  return listExampleModelCurrentPublicOrderFromSources({
    listAllPlaylistVideos,
    listLatestVideos: listLatest,
    modelSlug,
  });
}

export async function listExampleFamilyPage(
  familyId: string,
  options: Omit<ListExamplesPageOptions, 'engineGroup'>
): Promise<ListExamplesPageResult> {
  const { sort, limit = 150, offset = 0 } = options;
  if (isLocalPublicExamplesEnabled()) return listLocalPublicExamples(familyId, sort, limit, offset);
  if (shouldSkipBuildTimeMarketingVideoQueries()) return { items: [], total: 0, limit, offset, hasMore: false };
  const merged = await loadExampleFamilyFeed(familyId, { includeFamilyPlaylist: true });
  const sorted = sortVideosByPreference(merged, sort);
  return paginateGalleryVideos(sorted, limit, offset);
}

export async function listExamplesPage(options: ListExamplesPageOptions): Promise<ListExamplesPageResult> {
  const { sort, limit = 150, offset = 0, engineGroup } = options;
  if (isLocalPublicExamplesEnabled()) return listLocalPublicExamples(engineGroup ?? '', sort, limit, offset);
  if (shouldSkipBuildTimeMarketingVideoQueries()) return { items: [], total: 0, limit, offset, hasMore: false };
  const hubSlug = getExamplesHubPlaylistSlug();
  if (!hubSlug) {
    return { items: [], total: 0, limit, offset, hasMore: false };
  }

  const normalizedGroup = engineGroup ? engineGroup.trim().toLowerCase() : null;
  const curated = await listCuratedGalleryVideos(hubSlug, {engineAliases: normalizedGroup ? getExampleFamilyEngineAliases(normalizedGroup) : getDiscoverableExampleEngineAliases()});
  if (curated !== null) return paginateGalleryVideos(sortVideosByPreference(curated, sort), limit, offset);
  const baseFetchLimit = Math.max(limit + Math.max(offset, 0), limit);
  const playlistFetchLimit = normalizedGroup
    ? Math.min(baseFetchLimit * ENGINE_GROUP_FETCH_MULTIPLIER, ENGINE_GROUP_FETCH_CAP)
    : baseFetchLimit;

  const aggregated = await listPlaylistVideosWithOptions({
    slug: hubSlug, limit: playlistFetchLimit, engineAliases: normalizedGroup ? getExampleFamilyEngineAliases(normalizedGroup) : getDiscoverableExampleEngineAliases(),
  }).catch((error) => {
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
  if (shouldSkipBuildTimeMarketingVideoQueries()) return [];
  const hubSlug = getExamplesHubPlaylistSlug();
  if (!hubSlug) return [];
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
