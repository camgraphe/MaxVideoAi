import { getEngineAliases, listFalEngines, type FalEngineEntry } from '@/config/falEngines';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ADMIN_EXCLUDED_USER_IDS } from '@/lib/admin/exclusions';
import { supportsVideoGeneration } from '@/lib/models/catalog';

const WINDOW_DAYS = 30 as const;
const MIN_COMPLETED_JOBS = 30;
const MIN_DISTINCT_USERS = 5;
const COMPLETED_STATUSES = ['completed', 'success', 'succeeded', 'finished'];

export type BenchmarkLatencyAggregateRow = {
  engine_id: string;
  median_duration_ms: number | string | null;
  p90_duration_ms: number | string | null;
  as_of: string | Date | null;
};

export type PublicBenchmarkLatency = {
  engineId: string;
  modelSlug: string;
  medianDurationMs: number;
  p90DurationMs: number;
  asOf: string;
};

export type PublicBenchmarkLatencySnapshot = {
  status: 'available' | 'unavailable';
  windowDays: 30;
  asOf: string | null;
  rows: PublicBenchmarkLatency[];
};

export type BenchmarkQuery = <TRecord = unknown>(
  text: string,
  params?: readonly unknown[]
) => Promise<TRecord[]>;

function toNumber(value: number | string | null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

type CanonicalEngine = { engineId: string; modelSlug: string };

function buildCanonicalEngineByAlias(engines: FalEngineEntry[]) {
  const map = new Map<string, CanonicalEngine>();
  engines.forEach((engine) => {
    [engine.id, engine.modelSlug, engine.engine.id, ...getEngineAliases(engine)].forEach((alias) => {
      if (alias?.trim()) {
        map.set(alias.trim().toLowerCase(), { engineId: engine.id, modelSlug: engine.modelSlug });
      }
    });
  });
  return map;
}

function buildCanonicalAliasParams(engines: FalEngineEntry[]) {
  const canonicalEngineByAlias = buildCanonicalEngineByAlias(engines);
  return {
    aliases: Array.from(canonicalEngineByAlias.keys()),
    canonicalEngineIds: Array.from(canonicalEngineByAlias.values(), (engine) => engine.engineId),
  };
}

export function mapBenchmarkLatencyRows(
  rows: BenchmarkLatencyAggregateRow[],
  engines: FalEngineEntry[] = listFalEngines()
): PublicBenchmarkLatency[] {
  const canonicalEngineByAlias = buildCanonicalEngineByAlias(
    engines.filter((engine) => supportsVideoGeneration(engine))
  );
  return rows.flatMap((row) => {
    const canonicalEngine = canonicalEngineByAlias.get(row.engine_id.trim().toLowerCase());
    const medianDurationMs = toNumber(row.median_duration_ms);
    const p90DurationMs = toNumber(row.p90_duration_ms);
    const asOf = row.as_of instanceof Date ? row.as_of.toISOString() : row.as_of;
    if (!canonicalEngine || medianDurationMs == null || p90DurationMs == null || !asOf) return [];
    return [{ ...canonicalEngine, medianDurationMs, p90DurationMs, asOf }];
  });
}

export async function fetchPublicBenchmarkLatency(options?: {
  queryFn?: BenchmarkQuery;
  databaseConfigured?: boolean;
  engines?: FalEngineEntry[];
}): Promise<PublicBenchmarkLatencySnapshot> {
  const configured = options?.databaseConfigured ?? isDatabaseConfigured();
  if (!configured) return { status: 'unavailable', windowDays: WINDOW_DAYS, asOf: null, rows: [] };

  const queryFn = options?.queryFn ?? query;
  const engines = (options?.engines ?? listFalEngines()).filter((engine) => supportsVideoGeneration(engine));
  const { aliases, canonicalEngineIds } = buildCanonicalAliasParams(engines);
  try {
    const rawRows = await queryFn<BenchmarkLatencyAggregateRow>(
      `
        WITH canonical_engine_aliases AS (
          SELECT
            LOWER(TRIM(alias_map.engine_alias)) AS engine_alias,
            alias_map.canonical_engine_id
          FROM UNNEST($6::text[], $7::text[]) AS alias_map(engine_alias, canonical_engine_id)
        ),
        completed_cohort AS (
          SELECT
            canonical.canonical_engine_id AS engine_id,
            jobs.user_id,
            jobs.created_at,
            jobs.updated_at
          FROM app_jobs AS jobs
          JOIN canonical_engine_aliases AS canonical
            ON canonical.engine_alias = LOWER(TRIM(jobs.engine_id))
          WHERE jobs.created_at >= NOW() - make_interval(days => $2)
            AND jobs.user_id IS NOT NULL
            AND jobs.user_id <> ALL($1::text[])
            AND LOWER(COALESCE(jobs.status, '')) = ANY($3::text[])
        ),
        eligible_engines AS (
          SELECT engine_id
          FROM completed_cohort
          GROUP BY engine_id
          HAVING COUNT(*) >= $4
             AND COUNT(DISTINCT user_id) >= $5
        ),
        duration_samples AS (
          SELECT
            engine_id,
            updated_at,
            EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000 AS duration_ms
          FROM completed_cohort
          WHERE updated_at IS NOT NULL
            AND updated_at > created_at
        )
        SELECT
          engine_id,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS median_duration_ms,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_ms) AS p90_duration_ms,
          MAX(updated_at) AS as_of
        FROM duration_samples
        JOIN eligible_engines USING (engine_id)
        GROUP BY engine_id
        ORDER BY median_duration_ms ASC
      `,
      [
        ADMIN_EXCLUDED_USER_IDS,
        WINDOW_DAYS,
        COMPLETED_STATUSES,
        MIN_COMPLETED_JOBS,
        MIN_DISTINCT_USERS,
        aliases,
        canonicalEngineIds,
      ]
    );
    const rows = mapBenchmarkLatencyRows(rawRows, engines);
    const asOf = rows.reduce<string | null>((latest, row) => (!latest || row.asOf > latest ? row.asOf : latest), null);
    return { status: 'available', windowDays: WINDOW_DAYS, asOf, rows };
  } catch (error) {
    console.warn('[benchmark-lab] latency snapshot unavailable', error);
    return { status: 'unavailable', windowDays: WINDOW_DAYS, asOf: null, rows: [] };
  }
}
