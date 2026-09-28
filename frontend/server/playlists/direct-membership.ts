import { query, type QueryExecutor } from '@/lib/db';
import { getCurationAliases } from './curation-store';
import { CURATION_ELIGIBILITY } from './curation-eligibility';
const PUBLIC_VIDEO_PREDICATE_PLAYLIST = `aj.visibility = 'public' AND COALESCE(aj.indexable, TRUE)`;

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
