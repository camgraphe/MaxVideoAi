import { marketingVideoReader } from '@/server/marketing-media/public-read';
import { query, type QueryExecutor } from '@/lib/db';
import { getCurationAliases } from './curation-store';
import { CURATION_ELIGIBILITY } from './curation-eligibility';
import { mapGalleryVideoRow, type VideoRow } from '../videos-normalization';
import { BASE_SELECT } from '../videos-query';
const PUBLIC_VIDEO_PREDICATE_PLAYLIST = `aj.visibility = 'public' AND COALESCE(aj.indexable, TRUE)`;

type DirectPageOptions = { offset: number; limit: number };

async function readDirectPlaylistPage<Row>(
  slug: string, options: DirectPageOptions, db: QueryExecutor, projection: string, tieBreak: string,
): Promise<Row[]> {
  const {limit, offset} = options;
  const read = (withCuration: boolean) => marketingVideoReader(db).query<Row>(`WITH source AS (
    SELECT p.id,p.is_public,${withCuration ? "c.mode,ARRAY(SELECT jsonb_array_elements_text(NULLIF(to_jsonb(c)->'opening_ids','null'::jsonb))) || c.ordered_ids AS ordered_ids,c.excluded_ids" : 'NULL::text AS mode,NULL::text[] AS ordered_ids,NULL::text[] AS excluded_ids'}
    FROM playlists p ${withCuration ? 'LEFT JOIN playlist_curations c ON c.playlist_id=p.id' : ''} WHERE p.slug=$1
  ), membership AS (
    SELECT aj.job_id,aj.created_at,false AS managed,CASE WHEN pi.order_index IS NULL THEN 1 ELSE 0 END AS selection_group,
      -pi.order_index::bigint AS selection_order
    FROM source p JOIN playlist_items pi ON pi.playlist_id=p.id JOIN app_jobs aj ON aj.job_id=pi.video_id
    WHERE p.is_public=TRUE AND p.mode IS NULL AND ${PUBLIC_VIDEO_PREDICATE_PLAYLIST}
    UNION ALL
    SELECT job_id,created_at,true AS managed,CASE WHEN job_id=ANY(p.ordered_ids) THEN 0 ELSE 1 END,
      array_position(p.ordered_ids,job_id)::bigint
    FROM source p CROSS JOIN app_jobs WHERE p.is_public=TRUE AND p.mode IS NOT NULL
      AND ${CURATION_ELIGIBILITY} AND LOWER(engine_id)=ANY($4::text[])
      AND NOT job_id=ANY(p.excluded_ids) AND (p.mode='hybrid' OR job_id=ANY(p.ordered_ids))
  ), page AS (
    SELECT * FROM membership ORDER BY selection_group,selection_order,created_at DESC,${tieBreak} LIMIT $2 OFFSET $3
  ) ${projection}`,
  [slug, limit, offset, (getCurationAliases(slug) ?? []).map(alias => alias.toLowerCase())]);
  try { return await read(true); }
  catch (error) {
    const failure = error as { code?: string; message?: string };
    if (failure.code !== '42P01' || !failure.message?.includes('playlist_curations')) throw error;
    return read(false);
  }
}

/** ID-only direct-reader projection for admin adoption; keep legacy membership semantics. */
export async function listPlaylistVideoIds(
  slug: string, options: DirectPageOptions, db: QueryExecutor = { query },
): Promise<{ ids: string[]; total: number }> {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Math.floor(options.limit))) : 500;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset)) : 0;
  const rows = await readDirectPlaylistPage<{ job_id: string | null; total: number }>(slug, {limit,offset}, db,
    `SELECT totals.total,page.job_id FROM (SELECT count(*)::int AS total FROM membership) totals
     LEFT JOIN page ON TRUE ORDER BY page.selection_group,page.selection_order,page.created_at DESC,page.job_id ASC`,
    'job_id ASC');
  return { ids: rows.flatMap(row => row.job_id ? [row.job_id] : []), total: Number(rows[0]?.total ?? 0) };
}

/** Only hydrate the selected page. An empty or private managed playlist still owns its selection. */
export async function readModelPlaylistPage(slug: string, limit: number, db: QueryExecutor = { query }) {
  // Apply the page IDs before projecting posters and dimensions. Without this boundary
  // PostgreSQL can evaluate those per-video lookups for the entire marketing/legacy union.
  const rows = await readDirectPlaylistPage<VideoRow & { managed: boolean }>(slug, {offset: 0, limit}, db,
    `, selected_media AS MATERIALIZED (
       ${BASE_SELECT} WHERE job_id = ANY(ARRAY(SELECT job_id FROM page))
     )
     SELECT ownership.managed, media.*, CASE WHEN NOT ownership.managed THEN (-page.selection_order)::int END AS order_index
     FROM (SELECT mode IS NOT NULL AS managed FROM source) ownership
     LEFT JOIN page ON TRUE
     LEFT JOIN selected_media media ON media.job_id = page.job_id
     WHERE ownership.managed OR page.job_id IS NOT NULL
     ORDER BY page.selection_group,page.selection_order,page.created_at DESC,CASE WHEN ownership.managed THEN page.job_id END ASC`,
    'CASE WHEN managed THEN job_id END ASC');
  const managed = rows[0]?.managed ?? false;
  const videos = rows.filter(row => row.job_id).map(row => {
    if (managed) return mapGalleryVideoRow(row);
    // Legacy playlist cards historically omit per-generation recipe fields.
    return mapGalleryVideoRow({ ...row, requested_resolution: undefined, generation_mode: undefined, generation_operation: undefined });
  });
  return { videos, managed };
}
