import { isDatabaseConfigured } from '@/lib/db';
import { getServiceNoticeSetting } from '@/server/app-settings';
import type { AdminHealthSnapshot, EngineHealthStat } from '@/lib/admin/types';
import {
  HEALTH_WINDOW_HOURS,
  PENDING_STALE_MINUTES,
  coerceNumber,
  completedCondition,
  refundedFailedCondition,
  safeQuery,
  unresolvedFailedCondition,
  type CountValueRow,
  type FailedEngineRow,
} from '@/server/admin-metrics/admin-metrics-helpers';

export async function fetchAdminHealth(): Promise<AdminHealthSnapshot> {
  const notice = await getServiceNoticeSetting();
  const message = notice.message?.trim() ?? '';
  const serviceNotice = {
    active: Boolean(notice.enabled && message.length),
    message: notice.enabled && message.length ? message : null,
  };

  if (!isDatabaseConfigured()) {
    return {
      failedRenders24h: 0,
      refundedFailures24h: 0,
      stalePendingJobs: 0,
      serviceNotice,
      engineStats: [],
    };
  }

  const [failedRows, refundedRows, pendingRows, engineRows] = await Promise.all([
    safeQuery<CountValueRow>(
      `
        SELECT COUNT(*)::bigint AS count
        FROM app_jobs j
        WHERE ${unresolvedFailedCondition('j')}
          AND created_at >= NOW() - INTERVAL '${HEALTH_WINDOW_HOURS} hours'
      `
    ),
    safeQuery<CountValueRow>(
      `
        SELECT COUNT(*)::bigint AS count
        FROM app_jobs j
        WHERE ${refundedFailedCondition('j')}
          AND created_at >= NOW() - INTERVAL '${HEALTH_WINDOW_HOURS} hours'
      `
    ),
    safeQuery<CountValueRow>(
      `
        SELECT COUNT(*)::bigint AS count
        FROM app_jobs
        WHERE status = 'pending'
          AND created_at <= NOW() - INTERVAL '${PENDING_STALE_MINUTES} minutes'
      `
    ),
    safeQuery<FailedEngineRow>(
      `
        SELECT
          COALESCE(NULLIF(j.engine_id, ''), 'unknown') AS engine_id,
          COALESCE(NULLIF(j.engine_label, ''), COALESCE(NULLIF(j.engine_id, ''), 'unknown')) AS engine_label,
          COUNT(*) FILTER (WHERE ${unresolvedFailedCondition('j')})::bigint AS failed_count,
          COUNT(*) FILTER (WHERE (${unresolvedFailedCondition('j')} OR ${completedCondition('j')}))::bigint AS total_count
        FROM app_jobs j
        WHERE created_at >= NOW() - INTERVAL '${HEALTH_WINDOW_HOURS} hours'
        GROUP BY engine_id, engine_label
        HAVING COUNT(*) FILTER (WHERE (${unresolvedFailedCondition('j')} OR ${completedCondition('j')})) > 0
      `
    ),
  ]);

  const failedRenders24h = coerceNumber(failedRows[0]?.count ?? 0);
  const refundedFailures24h = coerceNumber(refundedRows[0]?.count ?? 0);
  const stalePendingJobs = coerceNumber(pendingRows[0]?.count ?? 0);

  const engineStats: EngineHealthStat[] = engineRows
    .map((row) => {
      const failed = coerceNumber(row.failed_count);
      const total = coerceNumber(row.total_count);
      const engineId = row.engine_id ?? 'unknown';
      const engineLabel = row.engine_label ?? engineId;
      return {
        engineId,
        engineLabel,
        failedCount: failed,
        totalCount: total,
        failureRate: total ? failed / total : 0,
      };
    })
    .sort((a, b) => b.failureRate - a.failureRate);

  return {
    failedRenders24h,
    refundedFailures24h,
    stalePendingJobs,
    serviceNotice,
    engineStats,
  };
}
