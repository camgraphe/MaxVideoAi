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
  completed_count: number | string | null;
  distinct_users: number | string | null;
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

function buildModelSlugByAlias(engines: FalEngineEntry[]) {
  const map = new Map<string, string>();
  engines.forEach((engine) => {
    [engine.id, engine.modelSlug, engine.engine.id, ...getEngineAliases(engine)].forEach((alias) => {
      if (alias?.trim()) map.set(alias.trim().toLowerCase(), engine.modelSlug);
    });
  });
  return map;
}

export function mapBenchmarkLatencyRows(
  rows: BenchmarkLatencyAggregateRow[],
  engines: FalEngineEntry[] = listFalEngines()
): PublicBenchmarkLatency[] {
  const modelSlugByAlias = buildModelSlugByAlias(
    engines.filter((engine) => supportsVideoGeneration(engine))
  );
  return rows.flatMap((row) => {
    const modelSlug = modelSlugByAlias.get(row.engine_id.trim().toLowerCase());
    const medianDurationMs = toNumber(row.median_duration_ms);
    const p90DurationMs = toNumber(row.p90_duration_ms);
    const asOf = row.as_of instanceof Date ? row.as_of.toISOString() : row.as_of;
    if (!modelSlug || medianDurationMs == null || p90DurationMs == null || !asOf) return [];
    return [{ engineId: row.engine_id, modelSlug, medianDurationMs, p90DurationMs, asOf }];
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
  try {
    const rawRows = await queryFn<BenchmarkLatencyAggregateRow>(
      `
        WITH completed_jobs AS (
          SELECT
            COALESCE(NULLIF(engine_id, ''), 'unknown') AS engine_id,
            user_id,
            updated_at,
            EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000 AS duration_ms
          FROM app_jobs
          WHERE created_at >= NOW() - make_interval(days => $2)
            AND user_id IS NOT NULL
            AND user_id <> ALL($1::text[])
            AND LOWER(COALESCE(status, '')) = ANY($3::text[])
            AND updated_at IS NOT NULL
            AND updated_at > created_at
        )
        SELECT
          engine_id,
          COUNT(*)::bigint AS completed_count,
          COUNT(DISTINCT user_id)::bigint AS distinct_users,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS median_duration_ms,
          PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY duration_ms) AS p90_duration_ms,
          MAX(updated_at) AS as_of
        FROM completed_jobs
        GROUP BY engine_id
        HAVING COUNT(*) >= $4
           AND COUNT(DISTINCT user_id) >= $5
        ORDER BY median_duration_ms ASC
      `,
      [ADMIN_EXCLUDED_USER_IDS, WINDOW_DAYS, COMPLETED_STATUSES, MIN_COMPLETED_JOBS, MIN_DISTINCT_USERS]
    );
    const rows = mapBenchmarkLatencyRows(rawRows, options?.engines ?? listFalEngines());
    const asOf = rows.reduce<string | null>((latest, row) => (!latest || row.asOf > latest ? row.asOf : latest), null);
    return { status: 'available', windowDays: WINDOW_DAYS, asOf, rows };
  } catch (error) {
    console.warn('[benchmark-lab] latency snapshot unavailable', error);
    return { status: 'unavailable', windowDays: WINDOW_DAYS, asOf: null, rows: [] };
  }
}
