import type { BehaviorMetrics, FailedEngineStat, FunnelMetrics, HealthMetrics } from '@/lib/admin/types';
import {
  coerceNumber,
  toISO,
  type BehaviorRow,
  type DurationRow,
  type FailedEngineRow,
  type FunnelRow,
  type HealthRow,
  type ReturningRow,
  type WhaleRow,
} from '@/server/admin-metrics/admin-metrics-helpers';

export function buildFunnelMetrics(params: {
  totalAccounts: number;
  payingAccounts: number;
  funnelRows: FunnelRow[];
  signupTopupDurationRows: DurationRow[];
  topupRenderDurationRows: DurationRow[];
}): FunnelMetrics {
  const funnelRow = params.funnelRows[0];
  const totalTopupUsers = coerceNumber(funnelRow?.total_topup_users ?? 0);
  const convertedWithin30d = coerceNumber(funnelRow?.converted_within_30d ?? 0);

  return {
    signupToTopUpConversion: params.totalAccounts ? params.payingAccounts / params.totalAccounts : 0,
    totalTopupUsers,
    topUpToRenderConversion30d: totalTopupUsers ? convertedWithin30d / totalTopupUsers : 0,
    convertedWithin30dUsers: convertedWithin30d,
    avgTimeSignupToFirstTopUpDays:
      params.signupTopupDurationRows[0]?.avg_days != null ? Number(params.signupTopupDurationRows[0].avg_days) : null,
    avgTimeTopUpToFirstRenderDays:
      params.topupRenderDurationRows[0]?.avg_days != null ? Number(params.topupRenderDurationRows[0].avg_days) : null,
  };
}

export function buildBehaviorMetrics(
  behaviorStatsRows: BehaviorRow[],
  returningRows: ReturningRow[],
  whaleRows: WhaleRow[]
): BehaviorMetrics {
  return {
    avgRendersPerPayingUser30d: behaviorStatsRows[0]?.avg_renders != null ? Number(behaviorStatsRows[0].avg_renders) : 0,
    medianRendersPerPayingUser30d:
      behaviorStatsRows[0]?.median_renders != null ? Number(behaviorStatsRows[0].median_renders) : 0,
    returningUsers7d: coerceNumber(returningRows[0]?.returning_count ?? 0),
    whalesTop10: whaleRows.map((row) => ({
      userId: row.user_id,
      identifier: row.user_id ? row.user_id.slice(0, 8) : 'unknown',
      lifetimeTopupUsd: coerceNumber(row.lifetime_topup_cents) / 100,
      lifetimeChargeUsd: coerceNumber(row.lifetime_charge_cents) / 100,
      renderCount: coerceNumber(row.render_count ?? 0),
      firstSeenAt: row.first_seen_at ? toISO(row.first_seen_at) : null,
      lastActiveAt: row.last_active_at ? toISO(row.last_active_at) : null,
    })),
  };
}

function mapFailedEngineRows(rows: FailedEngineRow[]): FailedEngineStat[] {
  return rows.map((row) => {
    const failed = coerceNumber(row.failed_count);
    const total = coerceNumber(row.total_count);
    const engineId = row.engine_id ?? 'unknown';
    const engineLabel = row.engine_label ?? engineId;
    return {
      engineId,
      engineLabel,
      failedCount30d: failed,
      failureRate30d: total ? failed / total : 0,
    };
  });
}

export function buildHealthMetrics(healthRows: HealthRow[], failedByEngineRows: FailedEngineRow[]): HealthMetrics {
  const failedCount = coerceNumber(healthRows[0]?.failed_count ?? 0);
  const totalFailuresConsidered = coerceNumber(healthRows[0]?.total_count ?? 0);

  return {
    failedRenders30d: failedCount,
    failedRendersRate30d: totalFailuresConsidered ? failedCount / totalFailuresConsidered : 0,
    failedByEngine30d: mapFailedEngineRows(failedByEngineRows),
  };
}
