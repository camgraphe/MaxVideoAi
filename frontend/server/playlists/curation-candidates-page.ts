import { query, type QueryExecutor } from '@/lib/db';
import type { CurationItem } from '@/lib/admin/playlist-curation';
import { getExampleModelEngineAliases } from '@/lib/model-families';
import { videoOutputDimensionSelect } from '../videos-query';
import { CURATION_ELIGIBILITY } from './curation-service';
import { CurationError, curationFingerprint, getCurationAliases } from './curation-store';

type CandidateRow = {
  job_id: string; engine_id: string; engine_label: string | null; prompt: string | null;
  thumb_url: string | null; video_url: string; created_at: string; cursor_date: string | null;
  output_width: number | null; output_height: number | null; aspect_ratio: string | null;
};
const projection = `job_id,engine_id,engine_label,prompt,thumb_url,video_url,created_at,aspect_ratio,
  created_at::text AS cursor_date,
  (${videoOutputDimensionSelect('app_jobs', 'width')}) AS output_width,
  (${videoOutputDimensionSelect('app_jobs', 'height')}) AS output_height`;
const mapItem = (row: CandidateRow): CurationItem => ({
  id: row.job_id, engineId: row.engine_id, engineLabel: row.engine_label, prompt: row.prompt ?? '',
  thumbUrl: row.thumb_url, videoUrl: row.video_url, createdAt: new Date(row.created_at).toISOString(),
  outputWidth: row.output_width, outputHeight: row.output_height, aspectRatio: row.aspect_ratio,
});
function aliasesFor(slug: string): string[] {
  const aliases = getCurationAliases(slug);
  if (!aliases) throw new CurationError('Automatic curation is not supported for this destination', 400);
  return aliases.map(alias => alias.toLowerCase());
}

/** Eligibility-only batches let GET retain a complete order without loading all media. */
export async function filterEligibleCurationIds(slug: string, ids: string[], db: QueryExecutor = { query }): Promise<string[]> {
  const aliases = aliasesFor(slug);
  const eligible = new Set<string>();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const rows = await db.query<{ job_id: string }>(`SELECT job_id FROM app_jobs
      WHERE ${CURATION_ELIGIBILITY} AND LOWER(engine_id)=ANY($1::text[]) AND job_id=ANY($2::text[])`,
    [aliases, ids.slice(offset, offset + 500)]);
    rows.forEach(row => eligible.add(row.job_id));
  }
  return ids.filter(id => eligible.has(id));
}

export async function loadSelectedCurationItems(slug: string, ids: string[], db: QueryExecutor = { query }): Promise<CurationItem[]> {
  if (ids.length > 48) throw new CurationError('Select at most 48 videos per window', 400);
  const aliases = aliasesFor(slug);
  if (!ids.length) return [];
  const rows = await db.query<CandidateRow>(`SELECT ${projection} FROM app_jobs
    WHERE ${CURATION_ELIGIBILITY} AND LOWER(engine_id)=ANY($1::text[]) AND job_id=ANY($2::text[])
    ORDER BY array_position($2::text[],job_id) LIMIT 48`, [aliases, ids]);
  return rows.map(mapItem);
}

export type CandidatePageOptions = {
  slug: string; q?: string | null; modelSlug?: string | null; format?: string | null;
  cursor?: string | null; limit?: number; exactId?: string | null;
};
export async function searchCurationCandidatesPage(options: CandidatePageOptions, db: QueryExecutor = { query }): Promise<{
  items: CurationItem[]; nextCursor: string | null; total: number;
}> {
  let aliases = aliasesFor(options.slug);
  if (options.modelSlug) {
    const modelAliases = new Set(getExampleModelEngineAliases(options.modelSlug).map(id => id.toLowerCase()));
    aliases = aliases.filter(alias => modelAliases.has(alias));
  }
  const format = options.format || null;
  if (format && format !== '16:9' && format !== '9:16') throw new CurationError('Invalid video format', 400);
  const q = options.q?.trim() || null;
  const exactId = options.exactId || null;
  const signature = curationFingerprint({ slug: options.slug, aliases, format, q, exactId });
  let after: { date: string | null; id: string } | null = null;
  if (options.cursor) {
    try {
      if (options.cursor.length > 2000) throw new Error();
      const value = JSON.parse(Buffer.from(options.cursor, 'base64url').toString());
      if (value.signature !== signature || typeof value.id !== 'string' || !value.id || value.id.length > 200
        || !(value.date === null || typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2} [\d:.]+[+-]\d{2}(:\d{2})?$/.test(value.date) && Number.isFinite(Date.parse(value.date)))) throw new Error();
      after = value;
    } catch { throw new CurationError('Invalid candidate cursor; restart the search', 400); }
  }
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(48, Math.floor(options.limit!))) : 48;
  const params = [aliases, q, exactId, format, after !== null, after?.date ?? null, after?.id ?? null, limit];
  // Filter measured dimensions in SQL before count/page selection. Declared ratios only fill missing dimensions.
  const rows = await db.query<CandidateRow & { total: number; has_more: boolean }>(`WITH eligible AS MATERIALIZED (
    SELECT job_id,created_at,aspect_ratio,
      CASE WHEN $4::text IS NOT NULL THEN (${videoOutputDimensionSelect('app_jobs', 'width')}) END AS width,
      CASE WHEN $4::text IS NOT NULL THEN (${videoOutputDimensionSelect('app_jobs', 'height')}) END AS height
    FROM app_jobs WHERE ${CURATION_ELIGIBILITY} AND LOWER(engine_id)=ANY($1::text[])
      AND ($2::text IS NULL OR strpos(LOWER(COALESCE(prompt,'') || ' ' || COALESCE(engine_label,'') || ' ' || job_id),LOWER($2))>0)
      AND ($3::text IS NULL OR job_id=$3)
  ), ratios AS (
    SELECT *, CASE WHEN width>0 AND height>0 THEN width::double precision/height
      WHEN aspect_ratio ~ '^\\s*[0-9]+(\\.[0-9]+)?\\s*[:/]\\s*[0-9]+(\\.[0-9]+)?\\s*$'
      THEN split_part(replace(aspect_ratio,'/',':'),':',1)::double precision / NULLIF(split_part(replace(aspect_ratio,'/',':'),':',2)::double precision,0)
      ELSE NULL END AS ratio FROM eligible
  ), filtered AS (
    SELECT * FROM ratios WHERE $4::text IS NULL OR abs(ratio / CASE WHEN $4='16:9' THEN 16.0/9 ELSE 9.0/16 END - 1)<=0.02
  ), page AS (
    SELECT job_id,created_at FROM filtered WHERE NOT $5::boolean
      OR ($6::timestamptz IS NULL AND (created_at IS NOT NULL OR job_id>$7))
      OR ($6::timestamptz IS NOT NULL AND (created_at<$6 OR (created_at=$6 AND job_id>$7)))
    ORDER BY created_at DESC,job_id ASC LIMIT ($8::int + 1)
  ), selected AS (
    SELECT * FROM page ORDER BY created_at DESC,job_id ASC LIMIT $8
  ) SELECT totals.total,totals.has_more,media.* FROM
    (SELECT (SELECT count(*)::int FROM filtered) AS total,(SELECT count(*)>$8 FROM page) AS has_more) totals
    LEFT JOIN selected ON TRUE
    LEFT JOIN LATERAL (SELECT ${projection} FROM app_jobs WHERE app_jobs.job_id=selected.job_id) media ON TRUE
    ORDER BY selected.created_at DESC,selected.job_id ASC`, params);
  const page = rows.filter(row => row.job_id);
  const last = page.at(-1);
  return { items: page.map(mapItem), total: Number(rows[0]?.total ?? 0), nextCursor: rows[0]?.has_more && last
    ? Buffer.from(JSON.stringify({ signature, date: last.cursor_date, id: last.job_id })).toString('base64url') : null };
}

/** Complete eligible order for an explicit policy switch; each response contains only IDs. */
export async function listCurationCandidateIdsPage(
  slug: string, options: { offset: number; limit: number }, db: QueryExecutor = { query },
): Promise<{ ids: string[]; total: number }> {
  const aliases = aliasesFor(slug);
  const offset = Number.isFinite(options.offset) ? Math.max(0, Math.floor(options.offset)) : 0;
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.min(500, Math.floor(options.limit))) : 500;
  const rows = await db.query<{ job_id: string | null; total: number }>(`WITH eligible AS MATERIALIZED (
    SELECT job_id,created_at FROM app_jobs WHERE ${CURATION_ELIGIBILITY} AND LOWER(engine_id)=ANY($1::text[])
  ), page AS (
    SELECT * FROM eligible ORDER BY created_at DESC,job_id ASC LIMIT $2 OFFSET $3
  ) SELECT totals.total,page.job_id FROM (SELECT count(*)::int AS total FROM eligible) totals
    LEFT JOIN page ON TRUE ORDER BY page.created_at DESC,page.job_id ASC`, [aliases, limit, offset]);
  return { ids: rows.flatMap(row => row.job_id ? [row.job_id] : []), total: Number(rows[0]?.total ?? 0) };
}
