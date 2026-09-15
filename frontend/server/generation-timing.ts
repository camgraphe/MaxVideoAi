import { getEngineAliases, listFalEngines } from '@/config/falEngines';
import { isDatabaseConfigured, query } from '@/lib/db';
import type { GenerationTimingCell } from '@/lib/generation-timing';
import type { DurationQuery } from './generate-metrics';

type TimingRow = {
  engine_id: string; mode: string | null; duration_sec: number | null; resolution: string | null;
  sample_count: string | number; avg_ms: string | number;
  stddev_ms: string | number | null; recent_stddev_ms: string | number | null;
  recent_count: string | number; recent_avg_ms: string | number | null;
};

/** All historical evidence seeds the matrix. Recent (30-day) means are separate. */
export async function fetchGenerationTimingMatrix(options?: {
  queryFn?: DurationQuery; databaseConfigured?: boolean;
}): Promise<Record<string, GenerationTimingCell[]>> {
  if (!(options?.databaseConfigured ?? isDatabaseConfigured())) return {};
  const aliases = new Map<string, string>();
  for (const engine of listFalEngines()) {
    for (const alias of [engine.id, engine.modelSlug, engine.engine.id, ...getEngineAliases(engine)]) {
      if (alias?.trim()) aliases.set(alias.trim().toLowerCase(), engine.id);
    }
  }
  const rows = await (options?.queryFn ?? query)<TimingRow>(`
    WITH aliases AS (
      SELECT unnest($1::text[]) AS alias, unnest($2::text[]) AS engine_id
    ), samples AS (
      SELECT COALESCE(a.engine_id, s.engine_id) AS engine_id, s.mode, s.duration_sec, s.resolution,
        s.completed_at, EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) * 1000 AS duration_ms
      FROM generation_timing_samples s
      LEFT JOIN aliases a ON a.alias = LOWER(TRIM(s.engine_id))
    )
    SELECT engine_id, mode, duration_sec, resolution,
      COUNT(*) AS sample_count, AVG(duration_ms) AS avg_ms,
      STDDEV_SAMP(duration_ms) AS stddev_ms,
      STDDEV_SAMP(duration_ms) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days') AS recent_stddev_ms,
      COUNT(*) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days') AS recent_count,
      AVG(duration_ms) FILTER (WHERE completed_at >= NOW() - INTERVAL '30 days') AS recent_avg_ms
    FROM samples
    GROUP BY GROUPING SETS ((engine_id), (engine_id, mode), (engine_id, mode, duration_sec, resolution))
    HAVING (GROUPING(mode) = 1 OR mode IS NOT NULL)
      AND (GROUPING(duration_sec) = 1 OR (duration_sec > 0 AND resolution IS NOT NULL))
    ORDER BY engine_id, mode NULLS FIRST, duration_sec NULLS FIRST, resolution NULLS FIRST
  `, [[...aliases.keys()], [...aliases.values()]]);
  const matrix: Record<string, GenerationTimingCell[]> = {};
  for (const row of rows) {
    const averageDurationMs = Number(row.avg_ms);
    if (!Number.isFinite(averageDurationMs) || averageDurationMs <= 0) continue;
    (matrix[row.engine_id] ??= []).push({
      mode: row.mode, durationSec: row.duration_sec, resolution: row.resolution,
      sampleCount: Number(row.sample_count), averageDurationMs,
      recentSampleCount: Number(row.recent_count),
      stdDevDurationMs: row.stddev_ms == null ? null : Number(row.stddev_ms),
      recentStdDevDurationMs: row.recent_stddev_ms == null ? null : Number(row.recent_stddev_ms),
      recentAverageDurationMs: row.recent_avg_ms == null ? null : Number(row.recent_avg_ms),
    });
  }
  return matrix;
}
