import { getCurationAliases } from './playlists/curation-store';
import { query, type QueryExecutor } from '@/lib/db';
import { isLocalPublicExamplesEnabled, listLocalModelExamples } from './local-public-examples';
import { mapGalleryVideoRow, type GalleryVideo, type VideoRow } from './videos-normalization';
import { BASE_SELECT, imageThumbFallbackSelect, videoOutputDimensionSelect } from './videos-query';
import {
  resolveCuratedPlaylist,
  readCurationConfigurations,
  CURATION_ELIGIBILITY,
  type CurationConfiguration,
} from './playlists/curation-service';
const PUBLIC_VIDEO_PREDICATE_PLAYLIST = `
  aj.visibility = 'public'
  AND COALESCE(aj.indexable, TRUE)
`;

export type CurationReadScope = { resolve: (slug: string) => ReturnType<typeof resolveCuratedPlaylist> };

/** One loader invocation only; retain null/empty results, but allow failed reads to retry. */
export function createCurationReadScope(): CurationReadScope {
  const resolutions = new Map<string, ReturnType<typeof resolveCuratedPlaylist>>();
  let scheduled = false;
  let requested = new Map<string, {
    resolve: (config: CurationConfiguration | null) => void;
    reject: (error: unknown) => void;
  }>();
  const readConfiguration = (slug: string) => new Promise<CurationConfiguration | null>((resolve, reject) => {
    requested.set(slug, { resolve, reject });
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      const wave = [...requested];
      requested = new Map();
      scheduled = false;
      // Small batches bound large ID-array responses; later waves never wait for earlier batches.
      for (let offset = 0; offset < wave.length; offset += 4) {
        const batch = wave.slice(offset, offset + 4);
        void readCurationConfigurations(batch.map(([key]) => key)).then(
          configs => { for (const [key, pending] of batch) pending.resolve(configs.get(key) ?? null); },
          error => { for (const [, pending] of batch) pending.reject(error); },
        );
      }
    });
  });
  return {
    resolve(slug) {
      let pending = resolutions.get(slug);
      if (!pending) {
        pending = resolveCuratedPlaylist(slug, readConfiguration).catch(error => {
          resolutions.delete(slug);
          throw error;
        });
        resolutions.set(slug, pending);
      }
      return pending;
    },
  };
}

export async function listCuratedGalleryVideos(
  slug: string,
  options: {limit?: number; engineAliases?: string[] | null} = {},
  curationScope?: CurationReadScope,
): Promise<GalleryVideo[] | null> {
  const curated = await (curationScope ? curationScope.resolve(slug) : resolveCuratedPlaylist(slug));
  if (curated === null) return null;
  const aliases = options.engineAliases ? new Set(options.engineAliases.map(id => id.toLowerCase())) : null;
  const eligible = curated.filter(item => !aliases || aliases.has(item.engineId.toLowerCase()));
  const ids = (options.limit === undefined ? eligible : eligible.slice(0, options.limit)).map(item => item.id);
  if (!ids.length) return [];
  // A shared resolution must not retain access after the playlist becomes private.
  const publicPlaylist = curationScope
    ? 'AND EXISTS (SELECT 1 FROM playlists p WHERE p.slug=$2 AND p.is_public=TRUE)'
    : '';
  const rows = await query<VideoRow>(
    `${BASE_SELECT} WHERE job_id=ANY($1::text[]) AND ${CURATION_ELIGIBILITY} ${publicPlaylist}`,
    curationScope ? [ids, slug] : [ids],
  );
  const mapped = new Map(rows.map(row => [row.job_id,mapGalleryVideoRow(row)]));
  return ids.flatMap(id => mapped.has(id) ? [mapped.get(id)!] : []);
}
type PlaylistVideoQueryOptions = {
  slug: string;
  limit?: number;
  engineAliases?: string[] | null;
};

export async function listPlaylistVideosWithOptions({
  slug,
  limit,
  engineAliases,
}: PlaylistVideoQueryOptions, curationScope?: CurationReadScope): Promise<GalleryVideo[]> {
  if (isLocalPublicExamplesEnabled()) {
    return slug.startsWith('examples-') ? listLocalModelExamples(slug.slice('examples-'.length), limit) : [];
  }
  const curated = await listCuratedGalleryVideos(slug, {limit, engineAliases}, curationScope);
  if (curated !== null) return curated;
  const params: unknown[] = [slug];
  const aliasFilter =
    Array.isArray(engineAliases)
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
             aj.aspect_ratio, (${videoOutputDimensionSelect('aj', 'width')}) AS output_width, (${videoOutputDimensionSelect('aj', 'height')}) AS output_height,
             aj.has_audio, aj.can_upscale, aj.created_at, aj.visibility,
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


/** ID-only direct-reader projection for admin adoption; keep legacy membership semantics. */
export async function listPlaylistVideoIds(
  slug: string, options: { offset: number; limit: number }, db: QueryExecutor = { query },
): Promise<{ ids: string[]; total: number }> {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Math.floor(options.limit))) : 500;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset)) : 0;
  const read = (withCuration: boolean) => db.query<{ job_id: string | null; total: number }>(`WITH source AS (
    SELECT p.id,p.is_public,${withCuration ? "c.mode,ARRAY(SELECT jsonb_array_elements_text(NULLIF(to_jsonb(c)->'opening_ids','null'::jsonb))) || c.ordered_ids AS ordered_ids,c.excluded_ids" : 'NULL::text AS mode,NULL::text[] AS ordered_ids,NULL::text[] AS excluded_ids'}
    FROM playlists p ${withCuration ? 'LEFT JOIN playlist_curations c ON c.playlist_id=p.id' : ''} WHERE p.slug=$1
  ), membership AS (
    SELECT aj.job_id,aj.created_at,CASE WHEN pi.order_index IS NULL THEN 1 ELSE 0 END AS selection_group,
      -pi.order_index::bigint AS selection_order
    FROM source p JOIN playlist_items pi ON pi.playlist_id=p.id JOIN app_jobs aj ON aj.job_id=pi.video_id
    WHERE p.is_public=TRUE AND p.mode IS NULL AND ${PUBLIC_VIDEO_PREDICATE_PLAYLIST}
    UNION ALL
    SELECT job_id,created_at,CASE WHEN job_id=ANY(p.ordered_ids) THEN 0 ELSE 1 END,
      array_position(p.ordered_ids,job_id)::bigint
    FROM source p CROSS JOIN app_jobs WHERE p.is_public=TRUE AND p.mode IS NOT NULL
      AND ${CURATION_ELIGIBILITY} AND LOWER(engine_id)=ANY($4::text[])
      AND NOT job_id=ANY(p.excluded_ids) AND (p.mode='hybrid' OR job_id=ANY(p.ordered_ids))
  ), page AS (
    SELECT * FROM membership ORDER BY selection_group,selection_order,created_at DESC,job_id ASC LIMIT $2 OFFSET $3
  ) SELECT totals.total,page.job_id FROM (SELECT count(*)::int AS total FROM membership) totals
    LEFT JOIN page ON TRUE ORDER BY page.selection_group,page.selection_order,page.created_at DESC,page.job_id ASC`,
  [slug, limit, offset, (getCurationAliases(slug) ?? []).map(alias => alias.toLowerCase())]);
  let rows;
  try { rows = await read(true); }
  catch (error) {
    const failure = error as { code?: string; message?: string };
    if (failure.code !== '42P01' || !failure.message?.includes('playlist_curations')) throw error;
    rows = await read(false);
  }
  return { ids: rows.flatMap(row => row.job_id ? [row.job_id] : []), total: Number(rows[0]?.total ?? 0) };
}
