import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

type GenerateMetricStatus = 'accepted' | 'rejected' | 'completed' | 'failed';

export type GenerateMetricInput = {
  jobId?: string | null;
  userId?: string | null;
  engineId: string;
  engineLabel?: string | null;
  mode?: string | null;
  status: GenerateMetricStatus;
  durationMs?: number | null;
  errorCode?: string | null;
  meta?: Record<string, unknown> | null;
};

type EngineMetricRow = {
  engine_id: string;
  engine_label: string | null;
  mode: string | null;
  accepted_count: string | number | null;
  rejected_count: string | number | null;
  completed_count: string | number | null;
  failed_count: string | number | null;
  avg_duration_ms: string | number | null;
  p95_duration_ms: string | number | null;
};

export type EnginePerformanceMetric = {
  engineId: string;
  engineLabel: string;
  mode: string;
  acceptedCount: number;
  rejectedCount: number;
  completedCount: number;
  failedCount: number;
  observedSampleCount?: number;
  averageDurationMs: number | null;
  p95DurationMs: number | null;
};

export type EngineAverageDuration = {
  source?: 'completion_event';
  engineId: string;
  completedCount: number;
  averageDurationMs: number | null;
};

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function coerceNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function recordGenerateMetric(input: GenerateMetricInput): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[generate-metrics] ensure schema failed', error);
    return;
  }

  try {
    await query(
      `
        INSERT INTO app_generate_metrics (
          job_id,
          user_id,
          engine_id,
          engine_label,
          mode,
          attempt_status,
          error_code,
          duration_ms,
          payload
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      `,
      [
        input.jobId ?? null,
        input.userId ?? null,
        input.engineId,
        input.engineLabel ?? null,
        input.mode ?? null,
        input.status,
        input.errorCode ?? null,
        typeof input.durationMs === 'number' && Number.isFinite(input.durationMs) ? Math.max(0, Math.trunc(input.durationMs)) : null,
        input.meta ? JSON.stringify(input.meta) : null,
      ]
    );
  } catch (error) {
    console.warn('[generate-metrics] insert failed', error);
  }
}

export async function fetchEnginePerformanceMetrics(days = 30): Promise<EnginePerformanceMetric[]> {
  if (!isDatabaseConfigured()) return [];

  const rows = await query<EngineMetricRow>(
    `
      SELECT
        engine_id,
        COALESCE(MAX(engine_label) FILTER (WHERE engine_label IS NOT NULL), engine_id) AS engine_label,
        COALESCE(mode, 'unknown') AS mode,
        COUNT(*) FILTER (WHERE attempt_status = 'accepted') AS accepted_count,
        COUNT(*) FILTER (WHERE attempt_status = 'rejected') AS rejected_count,
        COUNT(*) FILTER (WHERE attempt_status = 'completed') AS completed_count,
        COUNT(*) FILTER (WHERE attempt_status = 'failed') AS failed_count,
        NULL AS avg_duration_ms,
        NULL AS p95_duration_ms
      FROM app_generate_metrics
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY engine_id, mode
      ORDER BY engine_id ASC, mode ASC
    `,
    [String(days)]
  );

  // Request attempt events include historical misclassified completions. Their duration
  // is never a generation latency sample. Attach observed timings independently.
  const observed = await fetchObservedGenerationDurations(days);
  const result: EnginePerformanceMetric[] = rows.map((row) => ({
    engineId: row.engine_id,
    engineLabel: row.engine_label ?? row.engine_id,
    mode: row.mode ?? 'unknown',
    acceptedCount: coerceNumber(row.accepted_count),
    rejectedCount: coerceNumber(row.rejected_count),
    completedCount: coerceNumber(row.completed_count),
    failedCount: coerceNumber(row.failed_count),
    observedSampleCount: 0,
    averageDurationMs: null,
    p95DurationMs: null,
  }));
  for (const sample of observed) {
    result.push({
      engineId: sample.engine_id, engineLabel: sample.engine_id, mode: 'observed (all modes)',
      acceptedCount: 0, rejectedCount: 0, completedCount: 0, failedCount: 0,
      observedSampleCount: coerceNumber(sample.completed_count),
      averageDurationMs: coerceNullableNumber(sample.avg_duration_ms),
      p95DurationMs: coerceNullableNumber(sample.p95_duration_ms),
    });
  }
  return result;
}

type ObservedDurationRow = {
  engine_id: string;
  completed_count: number | string | null;
  avg_duration_ms: number | string | null;
  p95_duration_ms: number | string | null;
};

export type DurationQuery = <T>(sql: string, params?: readonly unknown[]) => Promise<T[]>;

/** Read-only: first explicit completion event, including queue/delivery wait.
 * No request-duration or mutable updated_at fallback; logging coverage is incomplete.
 */
export async function fetchObservedGenerationDurations(days = 30, options?: {
  queryFn?: DurationQuery;
  databaseConfigured?: boolean;
}): Promise<ObservedDurationRow[]> {
  if (!(options?.databaseConfigured ?? isDatabaseConfigured())) return [];
  const aliases = new Map<string, string>();
  for (const engine of listFalEngines()) {
    for (const alias of [engine.id, engine.modelSlug, engine.engine.id, ...getEngineAliases(engine)]) {
      if (alias?.trim()) aliases.set(alias.trim().toLowerCase(), engine.id);
    }
  }
  return (options?.queryFn ?? query)<ObservedDurationRow>(`
    WITH canonical_aliases AS (
      SELECT unnest($2::text[]) AS alias, unnest($3::text[]) AS engine_id
    ), samples AS (
      SELECT COALESCE(a.engine_id, j.engine_id) AS engine_id,
        EXTRACT(EPOCH FROM (completion.created_at - j.created_at)) * 1000 AS duration_ms
      FROM app_jobs j
      LEFT JOIN canonical_aliases a ON a.alias = LOWER(TRIM(j.engine_id))
      JOIN LATERAL (
        SELECT l.created_at FROM fal_queue_log l
        WHERE l.job_id = j.job_id AND LOWER(l.status) IN ('completed', 'poll:completed')
        ORDER BY l.created_at ASC LIMIT 1
      ) completion ON completion.created_at > j.created_at
      WHERE j.status = 'completed' AND j.created_at >= NOW() - ($1::text || ' days')::interval
    )
    SELECT engine_id, COUNT(*) AS completed_count, AVG(duration_ms) AS avg_duration_ms,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration_ms
    FROM samples GROUP BY engine_id ORDER BY engine_id
  `, [String(days), [...aliases.keys()], [...aliases.values()]]);
}

export async function fetchEngineAverageDurations(days = 30, options?: {
  queryFn?: DurationQuery;
  databaseConfigured?: boolean;
}): Promise<EngineAverageDuration[]> {
  const rows = await fetchObservedGenerationDurations(days, options);
  return rows.flatMap((row) => {
    const averageDurationMs = coerceNullableNumber(row.avg_duration_ms);
    const completedCount = coerceNumber(row.completed_count);
    if (averageDurationMs == null || averageDurationMs <= 0 || completedCount <= 0) return [];
    return [{ engineId: row.engine_id, completedCount, averageDurationMs, source: 'completion_event' as const }];
  });
}
