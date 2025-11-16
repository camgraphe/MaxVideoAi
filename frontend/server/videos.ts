import { query } from '@/lib/db';
import { normalizeMediaUrl } from '@/lib/media';
import { getIndexablePlaylistSlugs, removeVideosFromIndexablePlaylists } from '@/server/indexing';
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
  };
}

export type GalleryTab = 'starter' | 'latest' | 'trending';

function getStarterPlaylistSlug(): string {
  const slug = process.env.STARTER_PLAYLIST_SLUG;
  if (typeof slug === 'string') {
    const trimmed = slug.trim();
    if (trimmed.length) {
      return trimmed;
    }
  }
  return 'starter';
}

const BASE_SELECT = `
  SELECT job_id, user_id, engine_id, engine_label, duration_sec, prompt, thumb_url, video_url,
         aspect_ratio, has_audio, can_upscale, created_at, visibility, indexable, featured, featured_order,
         final_price_cents, currency, pricing_snapshot
  FROM app_jobs
`;

export async function getVideoById(videoId: string): Promise<GalleryVideo | null> {
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id = $1 LIMIT 1`,
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

export async function listPlaylistVideos(slug: string, limit: number): Promise<GalleryVideo[]> {
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
        AND aj.visibility = 'public'
        AND COALESCE(aj.indexable, TRUE)
      ORDER BY pi.order_index ASC, aj.created_at DESC
      LIMIT $2
    `,
    [slug, limit]
  );
  return rows.map(mapRow);
}

async function listLatest(limit: number): Promise<GalleryVideo[]> {
  const rows = await query<VideoRow>(
    `
      ${BASE_SELECT}
      WHERE visibility = 'public'
        AND COALESCE(indexable, TRUE)
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
      WHERE visibility = 'public'
        AND COALESCE(indexable, TRUE)
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

export type ExampleSort = 'date-desc' | 'date-asc' | 'duration-desc' | 'duration-asc' | 'engine-asc';

export type ListExamplesPageOptions = {
  sort: ExampleSort;
  limit?: number;
  offset?: number;
};

export type ListExamplesPageResult = {
  items: GalleryVideo[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

function sortVideosByPreference(videos: GalleryVideo[], sort: ExampleSort): GalleryVideo[] {
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

export async function listExamplesPage(options: ListExamplesPageOptions): Promise<ListExamplesPageResult> {
  const { sort, limit = 60, offset = 0 } = options;
  const slugs = getIndexablePlaylistSlugs();
  if (!slugs.length) {
    return { items: [], total: 0, limit, offset, hasMore: false };
  }

  const playlistFetchLimit = Math.max(limit + Math.max(offset, 0), limit);

  const playlistResults = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const videos = await listPlaylistVideos(slug, playlistFetchLimit);
        return videos;
      } catch (error) {
        console.warn(`[examples] failed to load playlist "${slug}"`, error);
        return [] as GalleryVideo[];
      }
    })
  );

  const seen = new Set<string>();
  const aggregated: GalleryVideo[] = [];
  playlistResults.forEach((videos) => {
    videos.forEach((video) => {
      if (seen.has(video.id)) {
        return;
      }
      seen.add(video.id);
      aggregated.push(video);
    });
  });

  if (!aggregated.length) {
    return { items: [], total: 0, limit, offset, hasMore: false };
  }

  const sorted = sortVideosByPreference(aggregated, sort);
  const total = sorted.length;
  const start = Math.max(0, offset);
  const items = sorted.slice(start, start + limit);
  return {
    items,
    total,
    limit,
    offset: start,
    hasMore: start + items.length < total,
  };
}

export async function listExamples(sort: ExampleSort, limit = 60): Promise<GalleryVideo[]> {
  const result = await listExamplesPage({ sort, limit, offset: 0 });
  return result.items;
}

export async function getPlaylistExamples(limit = 60): Promise<GalleryVideo[]> {
  const slugs = getIndexablePlaylistSlugs();
  const firstSlug = slugs[0];
  if (!firstSlug) {
    return [];
  }
  return listPlaylistVideos(firstSlug, limit);
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
