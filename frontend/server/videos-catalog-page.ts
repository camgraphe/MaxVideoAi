import { query, type QueryExecutor } from '@/lib/db';
import { listRuntimeModels } from '@/config/model-runtime';
import { getDiscoverableExampleEngineAliases } from '@/lib/examples/discovery';
import { getExampleFamilyEngineAliases, getExampleFamilyIds } from '@/lib/model-families';
import { getExamplesHubPlaylistSlug, getFamilyFeedSourceSlugs } from './playlists/slugs';
import { getCurationAliases } from './playlists/curation-store';
import { CURATION_ELIGIBILITY } from './playlists/curation-service';
import { BASE_SELECT } from './videos-query';
import { mapGalleryVideoRow, type VideoRow } from './videos-normalization';
import type { ExampleSort, ListExamplesPageResult } from './videos-examples';

type CatalogPageOptions = {
  familyId?: string;
  engineAliases?: string[];
  sort: ExampleSort;
  limit: number;
  offset: number;
};

const SORT_SQL: Record<ExampleSort, string> = {
  playlist: 'source_rank, selection_group, selection_order, created_at DESC, job_id ASC',
  'date-desc': 'created_at DESC, job_id ASC',
  'date-asc': 'created_at ASC, job_id ASC',
  'duration-desc': 'COALESCE(duration_sec,0) DESC, job_id ASC',
  'duration-asc': 'COALESCE(duration_sec,0) ASC, job_id ASC',
  'engine-asc': "COALESCE(engine_label,'') ASC, created_at DESC, job_id ASC",
};

function catalogSql(sort: ExampleSort, withCuration: boolean, idsOnly = false): string {
  const curationColumns = withCuration
    ? "c.mode,ARRAY(SELECT jsonb_array_elements_text(NULLIF(to_jsonb(c)->'opening_ids','null'::jsonb))) || c.ordered_ids AS ordered_ids,c.excluded_ids"
    : 'NULL::text AS mode,NULL::text[] AS ordered_ids,NULL::text[] AS excluded_ids';
  const curationJoin = withCuration ? 'LEFT JOIN playlist_curations c ON c.playlist_id=p.id' : '';
  // Count, selected IDs and media are evaluated in one PostgreSQL statement/snapshot.
  // Only page membership reaches the expensive media/settings projection.
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
    SELECT job_id,engine_id,engine_label,created_at,duration_sec FROM app_jobs
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
  ) ${idsOnly ? `SELECT totals.total,page.job_id
    FROM (SELECT COUNT(*)::int AS total FROM unique_memberships) totals
    LEFT JOIN selected_page page ON TRUE ORDER BY page.ordinal` : `SELECT totals.total,media.*
    FROM (SELECT COUNT(*)::int AS total FROM unique_memberships) totals
    LEFT JOIN selected_page page ON TRUE
    LEFT JOIN LATERAL (${BASE_SELECT} WHERE app_jobs.job_id=page.job_id) media ON TRUE
    ORDER BY page.ordinal`}`;
}

async function readCatalogRows(options: CatalogPageOptions, idsOnly: boolean, db: QueryExecutor) {
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : 24;
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset)) : 0;
  const empty: Array<VideoRow & { total: number }> = [];

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
  const expandAliases = (values: string[]) => {
    const expanded = new Set(values.map(alias => alias.toLowerCase()));
    for (const model of listRuntimeModels()) {
      if (expanded.has(model.id) || expanded.has(model.slug)) {
        model.aliases.internal.forEach(alias => expanded.add(alias.toLowerCase()));
      }
    }
    return [...expanded];
  };
  // Historical internal IDs use the same registry identity for eligibility and curated membership.
  const sources = slugs.map((source, source_rank) => ({ ...source, source_rank, aliases: expandAliases(getCurationAliases(source.slug) ?? []) }));
  const params = [JSON.stringify(sources), expandAliases(aliases), limit, offset];
  type CatalogRow = VideoRow & { total: number };
  let result: CatalogRow[];
  try {
    result = await db.query<CatalogRow>(catalogSql(options.sort, true, idsOnly), params);
  } catch (error) {
    // Missing optional curation storage is the only schema error that permits fallback.
    const failure = error as { code?: string; message?: string };
    if (failure.code !== '42P01' || !failure.message?.includes('playlist_curations')) throw error;
    result = await db.query<CatalogRow>(catalogSql(options.sort, false, idsOnly), params);
  }
  return result;
}

/** Same membership, precedence and order as the public reader, without media hydration. */
export async function listCatalogMembershipIds(
  options: { familyId?: string; offset: number; limit: number }, db: QueryExecutor = { query },
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
  return { items, total, limit, offset, hasMore: offset + items.length < total };
}
