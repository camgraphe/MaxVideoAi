import { query } from '@/lib/db';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { getExampleFamilyEngineAliases } from '@/lib/model-families';
import { getIndexablePlaylistSlugs } from '@/server/indexing';
import { removeVideosFromIndexablePlaylists } from '@/server/indexing';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs, getStarterPlaylistSlug } from '@/server/playlists';
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

const imageThumbFallbackSelect = (jobAlias: string) => `
             SELECT COALESCE(NULLIF(jo.thumb_url, ''), NULLIF(jo.url, ''), NULLIF(jo.storage_url, ''))
               FROM job_outputs jo
              WHERE jo.job_id = ${jobAlias}.job_id
                AND jo.kind = 'image'
              ORDER BY jo.created_at ASC
              LIMIT 1
`;

const BASE_SELECT = `
  SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt,
         COALESCE(NULLIF(thumb_url, ''), (${imageThumbFallbackSelect('app_jobs')})) AS thumb_url,
         video_url,
         to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url,
         to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls,
         aspect_ratio, has_audio, can_upscale, created_at, visibility, indexable, featured, featured_order,
         final_price_cents, currency, pricing_snapshot
  FROM app_jobs
`;

const BASE_SELECT_WITH_SETTINGS = `
  SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt,
         COALESCE(NULLIF(thumb_url, ''), (${imageThumbFallbackSelect('app_jobs')})) AS thumb_url,
         video_url,
         to_jsonb(app_jobs)->>'preview_video_url' AS preview_video_url,
         to_jsonb(app_jobs)->'keyframe_urls' AS keyframe_urls,
         aspect_ratio, has_audio, can_upscale, created_at, visibility, indexable, featured, featured_order,
         final_price_cents, currency, settings_snapshot
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
  const map = new Map<string, GalleryVideo>();
  rows.forEach((row) => {
    map.set(row.job_id, mapGalleryVideoRow(row));
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
    map.set(row.job_id, mapGalleryVideoRow(row));
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
    map.set(row.job_id, mapGalleryVideoRow(row));
  });
  return map;
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
      SELECT aj.job_id, aj.user_id, aj.engine_id, aj.engine_label, aj.duration_sec, aj.prompt,
             COALESCE(NULLIF(aj.thumb_url, ''), (${imageThumbFallbackSelect('aj')})) AS thumb_url,
             aj.video_url, to_jsonb(aj)->>'preview_video_url' AS preview_video_url, to_jsonb(aj)->'keyframe_urls' AS keyframe_urls,
             aj.aspect_ratio, aj.has_audio, aj.can_upscale, aj.created_at, aj.visibility,
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
  return rows.map(mapGalleryVideoRow);
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

export async function listExampleFamilyCurrentPublicOrder(familyId: string): Promise<GalleryVideo[]> {
  const normalizedFamilyId = resolveExampleCanonicalSlug(familyId) ?? familyId.trim().toLowerCase();
  if (!normalizedFamilyId) {
    return [];
  }

  const slugs = getIndexablePlaylistSlugs();
  if (!slugs.length) {
    return [];
  }

  const playlistResults = await Promise.all(
    slugs.map(async (slug) => listAllPlaylistVideos(slug).catch(() => [] as GalleryVideo[]))
  );

  return mergeUniqueGalleryVideos(...playlistResults).filter(
    (video) => resolveExampleGroupId(video.engineId) === normalizedFamilyId
  );
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
