import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import type { EngineUsage } from '@/lib/admin/types';
import {
  ENGINE_USAGE_WINDOW_DAYS,
  mapEngineUsage,
  safeQuery,
  type EngineAggRow,
} from '@/server/admin-metrics/admin-metrics-helpers';

export async function loadEngineUsageRows(excludedUserIds?: string[]): Promise<EngineAggRow[]> {
  const filteredUserIds = (excludedUserIds ?? []).map((userId) => userId.trim()).filter(Boolean);
  const hasExcludedUsers = filteredUserIds.length > 0;
  const excludeUserIdClause = hasExcludedUsers ? 'AND user_id <> ALL($1::text[])' : '';
  const params = hasExcludedUsers ? [filteredUserIds] : undefined;

  return safeQuery<EngineAggRow>(
    `
      WITH recent_jobs AS (
        SELECT
          job_id,
          COALESCE(NULLIF(engine_id, ''), 'unknown') AS engine_id,
          COALESCE(NULLIF(engine_label, ''), COALESCE(NULLIF(engine_id, ''), 'unknown')) AS engine_label,
          user_id
        FROM app_jobs
        WHERE status = 'completed'
          AND created_at >= NOW() - INTERVAL '${ENGINE_USAGE_WINDOW_DAYS} days'
          AND user_id IS NOT NULL
          ${excludeUserIdClause}
      ),
      charge_window AS (
        SELECT job_id, COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'charge'
          AND created_at >= NOW() - INTERVAL '${ENGINE_USAGE_WINDOW_DAYS} days'
        GROUP BY job_id
      )
      SELECT
        r.engine_id,
        r.engine_label,
        COUNT(*)::bigint AS render_count,
        COUNT(DISTINCT r.user_id)::bigint AS user_count,
        COALESCE(SUM(c.amount_cents), 0)::bigint AS amount_cents
      FROM recent_jobs r
      LEFT JOIN charge_window c ON c.job_id = r.job_id
      GROUP BY r.engine_id, r.engine_label
      ORDER BY amount_cents DESC NULLS LAST
    `,
    params
  );
}

export async function fetchEngineUsageMetrics(): Promise<EngineUsage[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }
  await ensureBillingSchema();
  const rows = await loadEngineUsageRows();
  return mapEngineUsage(rows);
}
