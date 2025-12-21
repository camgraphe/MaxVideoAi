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

type EngineAverageRow = {
  engine_id: string;
  completed_count: string | number | null;
  avg_duration_ms: string | number | null;
};

export type EnginePerformanceMetric = {
  engineId: string;
  engineLabel: string;
  mode: string;
  acceptedCount: number;
  rejectedCount: number;
  completedCount: number;
  failedCount: number;
  averageDurationMs: number | null;
  p95DurationMs: number | null;
};

export type EngineAverageDuration = {
  engineId: string;
  completedCount: number;
  averageDurationMs: number | null;
};

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function coerceNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return value;
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
        typeof input.durationMs === 'number' ? Math.max(0, Math.trunc(input.durationMs)) : null,
        input.meta ? JSON.stringify(input.meta) : null,
      ]
    );
  } catch (error) {
    console.warn('[generate-metrics] insert failed', error);
  }
}

export async function fetchEnginePerformanceMetrics(days = 30): Promise<EnginePerformanceMetric[]> {
  if (!isDatabaseConfigured()) return [];

  await ensureBillingSchema();

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
        AVG(duration_ms) FILTER (WHERE attempt_status = 'completed' AND duration_ms IS NOT NULL) AS avg_duration_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)
          FILTER (WHERE attempt_status = 'completed' AND duration_ms IS NOT NULL) AS p95_duration_ms
      FROM app_generate_metrics
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY engine_id, mode
      ORDER BY engine_id ASC, mode ASC
    `,
    [String(days)]
  );

  return rows.map((row) => ({
    engineId: row.engine_id,
    engineLabel: row.engine_label ?? row.engine_id,
    mode: row.mode ?? 'unknown',
    acceptedCount: coerceNumber(row.accepted_count),
    rejectedCount: coerceNumber(row.rejected_count),
    completedCount: coerceNumber(row.completed_count),
    failedCount: coerceNumber(row.failed_count),
    averageDurationMs: coerceNullableNumber(row.avg_duration_ms),
    p95DurationMs: coerceNullableNumber(row.p95_duration_ms),
  }));
}

export async function fetchEngineAverageDurations(days = 30): Promise<EngineAverageDuration[]> {
  if (!isDatabaseConfigured()) return [];

  await ensureBillingSchema();

  const rows = await query<EngineAverageRow>(
    `
      SELECT
        engine_id,
        COUNT(*) FILTER (WHERE attempt_status = 'completed' AND duration_ms IS NOT NULL) AS completed_count,
        AVG(duration_ms) FILTER (WHERE attempt_status = 'completed' AND duration_ms IS NOT NULL) AS avg_duration_ms
      FROM app_generate_metrics
      WHERE created_at >= NOW() - ($1::text || ' days')::interval
      GROUP BY engine_id
      ORDER BY engine_id ASC
    `,
    [String(days)]
  );

  return rows.map((row) => ({
    engineId: row.engine_id,
    completedCount: coerceNumber(row.completed_count),
    averageDurationMs: coerceNullableNumber(row.avg_duration_ms),
  }));
}
