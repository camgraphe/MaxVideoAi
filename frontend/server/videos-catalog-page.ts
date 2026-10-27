import { marketingCatalogReader } from '@/server/marketing-media/public-read';
import { query, type QueryExecutor } from '@/lib/db';
import { getDiscoverableExampleEngineAliases } from '@/lib/examples/discovery';
import { getExampleFamilyEngineAliases, getExampleFamilyIds } from '@/lib/model-families';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs } from './playlists/slugs';
import { getCurationAliases } from './playlists/curation-store';
import { CURATION_ELIGIBILITY, expandCatalogAliases } from './playlists/curation-eligibility';
import { BASE_SELECT } from './videos-query';
import { mapGalleryVideoRow, type VideoRow } from './videos-normalization';
import type { ExampleSort, ExampleVersionSample, ListExamplesPageResult } from './videos-examples';

export type CatalogCurationOverride = { playlistId: string; draft: import('@/lib/admin/playlist-curation').CurationDraft };

type CatalogRow = VideoRow & { total: number; suppressed_source_slugs?: string[]; version_samples?: ExampleVersionSample[]; preview_variant?: 'current' | 'next' };

type CatalogPageOptions = {
  curationOverride?: CatalogCurationOverride;
  familyId?: string;
  engineAliases?: string[];
  sort: ExampleSort;
  limit: number;
  offset: number;
  includeVersionSamples?: boolean;
};

const SORT_SQL: Record<ExampleSort, string> = {
  playlist: 'source_rank, selection_group, selection_order, created_at DESC, job_id ASC',
  'date-desc': 'created_at DESC, job_id ASC',
  'date-asc': 'created_at ASC, job_id ASC',
  'duration-desc': 'COALESCE(duration_sec,0) DESC, job_id ASC',
  'duration-asc': 'COALESCE(duration_sec,0) ASC, job_id ASC',
  'engine-asc': "COALESCE(engine_label,'') ASC, created_at DESC, job_id ASC",
};

// Match absent source text after JavaScript trim(), including Unicode spaces/BOM.
const HAS_PROMPT_SQL = "prompt ~ '[^[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]'";

function catalogSql(sort: ExampleSort, withCuration: boolean, idsOnly = false, override = false, includeVersionSamples = false): string {
  const savedCurationColumns = withCuration
    ? "c.mode,ARRAY(SELECT jsonb_array_elements_text(NULLIF(to_jsonb(c)->'opening_ids','null'::jsonb))) || c.ordered_ids AS ordered_ids,c.excluded_ids"
    : 'NULL::text AS mode,NULL::text[] AS ordered_ids,NULL::text[] AS excluded_ids';
  const curationColumns = override ? `CASE WHEN p.id::text=$5::jsonb->>'playlistId' THEN $5::jsonb->'draft'->>'mode' ELSE c.mode END AS mode,
    CASE WHEN p.id::text=$5::jsonb->>'playlistId' THEN ARRAY(SELECT jsonb_array_elements_text(COALESCE(NULLIF($5::jsonb->'draft'->'openingIds','null'::jsonb),'[]'::jsonb))) || ARRAY(SELECT jsonb_array_elements_text($5::jsonb->'draft'->'orderedIds')) ELSE ARRAY(SELECT jsonb_array_elements_text(NULLIF(to_jsonb(c)->'opening_ids','null'::jsonb))) || c.ordered_ids END AS ordered_ids,
    CASE WHEN p.id::text=$5::jsonb->>'playlistId' THEN ARRAY(SELECT jsonb_array_elements_text($5::jsonb->'draft'->'excludedIds')) ELSE c.excluded_ids END AS excluded_ids` : savedCurationColumns;
  const curationJoin = withCuration ? 'LEFT JOIN playlist_curations c ON c.playlist_id=p.id' : '';
  const selectedMedia = BASE_SELECT.replace('FROM app_jobs', 'FROM selected_media AS app_jobs');
  // Count, selected IDs and media are evaluated in one PostgreSQL statement/snapshot.
  // Materialize only selected raw rows before evaluating media/settings projections.
  // Otherwise PostgreSQL can pull up the marketing UNION and hydrate every job.
  // Joining the overlay once also avoids decoding every publication per page item.
  // OFFSET 0 keeps each dimension/settings projection behind its selected-ID filter.
  return `WITH source_specs AS (
    SELECT * FROM jsonb_to_recordset($1::jsonb) AS spec(slug text,source_rank int,parent_slug text,aliases text[])
  ), sources AS (
    SELECT spec.*,p.id,p.is_public,${curationColumns}
    FROM source_specs spec JOIN playlists p ON p.slug=spec.slug ${curationJoin}
  ), active_sources AS (
    SELECT s.* FROM sources s WHERE s.is_public=TRUE
      AND (s.source_rank=0 OR NOT EXISTS (SELECT 1 FROM sources WHERE source_rank=0 AND mode IS NOT NULL))
      AND NOT EXISTS (SELECT 1 FROM sources parent WHERE parent.slug=s.parent_slug AND parent.mode IS NOT NULL)
  ), eligible AS NOT MATERIALIZED (
    SELECT job_id,engine_id,engine_label,created_at,duration_sec${includeVersionSamples ? `,${HAS_PROMPT_SQL} AS has_prompt` : ''} FROM catalog_jobs AS app_jobs
    WHERE ${CURATION_ELIGIBILITY} AND LOWER(engine_id)=ANY($2::text[])
  ), memberships AS (
    SELECT j.*,s.source_rank,CASE WHEN pi.order_index IS NULL THEN 1 ELSE 0 END AS selection_group,
      -pi.order_index::bigint AS selection_order
    FROM active_sources s JOIN playlist_items pi ON pi.playlist_id=s.id
    JOIN eligible j ON j.job_id=pi.video_id WHERE s.mode IS NULL
    UNION ALL
    SELECT j.*,s.source_rank,CASE WHEN j.job_id=ANY(s.ordered_ids) THEN 0 ELSE 1 END AS selection_group,
      array_position(s.ordered_ids,j.job_id)::bigint AS selection_order
    FROM active_sources s JOIN eligible j ON LOWER(j.engine_id)=ANY(s.aliases)
    WHERE s.mode IS NOT NULL AND NOT j.job_id=ANY(s.excluded_ids)
      AND (s.mode='hybrid' OR j.job_id=ANY(s.ordered_ids))
  ), unique_memberships AS (
    SELECT DISTINCT ON(job_id) * FROM memberships
    ORDER BY job_id,source_rank,selection_group,selection_order,created_at DESC
  ), selected_page AS (
    SELECT job_id,ROW_NUMBER() OVER (ORDER BY ${SORT_SQL[sort]}) AS ordinal
    FROM unique_memberships ORDER BY ${SORT_SQL[sort]} LIMIT $3 OFFSET $4
  )${idsOnly ? '' : `, selected_media AS MATERIALIZED (
    SELECT app_jobs.* FROM app_jobs JOIN selected_page ON app_jobs.job_id=selected_page.job_id
  )`} ${idsOnly ? `SELECT totals.total,page.job_id,page.ordinal AS preview_ordinal,
      ARRAY(SELECT slug FROM sources WHERE is_public=TRUE AND id NOT IN (SELECT id FROM active_sources) ORDER BY slug) AS suppressed_source_slugs
    FROM (SELECT COUNT(*)::int AS total FROM unique_memberships) totals
    LEFT JOIN selected_page page ON TRUE ORDER BY page.ordinal` : `SELECT totals.total,${includeVersionSamples ? `
      CASE WHEN page.ordinal=$4+1 OR page.job_id IS NULL THEN (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('engineId',engine_id,'videoId',job_id) ORDER BY ${SORT_SQL[sort]}),'[]'::jsonb)
        FROM (SELECT DISTINCT ON(engine_id) * FROM unique_memberships WHERE has_prompt
          ORDER BY engine_id,${SORT_SQL[sort]}) version_samples
      ) END AS version_samples,` : ''}media.*
    FROM (SELECT COUNT(*)::int AS total FROM unique_memberships) totals
    LEFT JOIN selected_page page ON TRUE
    LEFT JOIN LATERAL (${selectedMedia} WHERE app_jobs.job_id=page.job_id OFFSET 0) media ON TRUE
    ORDER BY page.ordinal`}`;
}

async function readCatalogRows(options: CatalogPageOptions, idsOnly: boolean, db: QueryExecutor, compare = false) {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : 24;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset)) : 0;
  const empty: CatalogRow[] = [];

  const hub = getExamplesHubPlaylistSlug();
  const sourceSpecs = options.familyId
    ? getFamilyFeedSourceSlugs(options.familyId).map(slug => ({ slug, parent_slug: null as string | null }))
    : [{ slug: hub, parent_slug: null as string | null }, ...getExampleFamilyIds().flatMap(family => {
        const [parent, ...children] = getFamilyFeedSourceSlugs(family);
        return [{ slug: parent, parent_slug: null }, ...children.filter(slug => slug !== hub).map(slug => ({ slug, parent_slug: parent }))];
      })];
  const slugs = [...new Map(sourceSpecs.map(source => [source.slug, source])).values()];
  if (!slugs.length) return empty;
  const aliases = options.engineAliases ?? (options.familyId
    ? getExampleFamilyEngineAliases(options.familyId)
    : getDiscoverableExampleEngineAliases());
  // Historical internal IDs use the same registry identity for eligibility and curated membership.
  const sources = slugs.map((source, source_rank) => ({ ...source, source_rank, aliases: expandCatalogAliases(getCurationAliases(source.slug) ?? []) }));
  const params = [JSON.stringify(sources), expandCatalogAliases(aliases), limit, offset, ...(options.curationOverride ? [JSON.stringify(options.curationOverride)] : [])];
  let result: CatalogRow[];
  try {
    const sql = compare
      ? `SELECT 'current' AS preview_variant,current_page.* FROM (${catalogSql(options.sort, true, true)}) current_page
         UNION ALL SELECT 'next' AS preview_variant,next_page.* FROM (${catalogSql(options.sort, true, true, true)}) next_page
         ORDER BY preview_variant,preview_ordinal`
      : catalogSql(options.sort, true, idsOnly, Boolean(options.curationOverride), options.includeVersionSamples);
    result = await marketingCatalogReader(db).query<CatalogRow>(sql, params);
  } catch (error) {
    // Missing optional curation storage is the only schema error that permits fallback.
    const failure = error as { code?: string; message?: string };
    if (options.curationOverride || failure.code !== '42P01' || !failure.message?.includes('playlist_curations')) throw error;
    result = await marketingCatalogReader(db).query<CatalogRow>(catalogSql(options.sort, false, idsOnly, false, options.includeVersionSamples), params);
  }
  return result;
}

/** Same membership, precedence and order as the public reader, without media hydration. */
export async function listCatalogMembershipIds(
  options: { familyId?: string; offset: number; limit: number; curationOverride?: CatalogCurationOverride }, db: QueryExecutor = { query },
): Promise<{ ids: string[]; total: number }> {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Math.floor(options.limit))) : 500;
  const result = await readCatalogRows({ ...options, limit, sort: 'playlist' }, true, db);
  return { ids: result.filter(row => row.job_id).map(row => row.job_id), total: Number(result[0]?.total ?? 0) };
}

export async function listCatalogPage(options: CatalogPageOptions): Promise<ListExamplesPageResult> {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : 24;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset)) : 0;
  if (!process.env.DATABASE_URL) return { items: [], total: 0, limit, offset, hasMore: false };
  const result = await readCatalogRows(options, false, { query });
  const total = Number(result[0]?.total ?? 0);
  const items = result.filter(row => row.job_id).map(mapGalleryVideoRow);
  return { items, total, limit, offset, hasMore: offset + items.length < total,
    ...(options.includeVersionSamples ? { versionSamples: result[0]?.version_samples ?? [] } : {}) };
}

/** Preview diagnostics use the exact same active-source CTE as public membership. */
export async function listCatalogPreviewIds(options: CatalogPageOptions, db: QueryExecutor) {
  const rows = await readCatalogRows(options, true, db);
  return projectPreviewRows(rows);
}

function projectPreviewRows(rows: CatalogRow[]) {
  return {
    ids: rows.filter(row => row.job_id).map(row => row.job_id),
    total: Number(rows[0]?.total ?? 0),
    suppressedSourceSlugs: rows[0]?.suppressed_source_slugs ?? [],
  };
}

/** Two exact public-reader CTEs, one round-trip and one PostgreSQL snapshot. */
export async function listCatalogPreviewPair(
  options: CatalogPageOptions & { curationOverride: CatalogCurationOverride }, db: QueryExecutor,
) {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Math.floor(options.limit))) : 500;
  const rows = await readCatalogRows({ ...options, limit }, true, db, true);
  return {
    current: projectPreviewRows(rows.filter(row => row.preview_variant === 'current')),
    next: projectPreviewRows(rows.filter(row => row.preview_variant === 'next')),
  };
}
