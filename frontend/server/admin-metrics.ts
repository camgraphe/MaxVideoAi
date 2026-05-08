import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getServiceNoticeSetting } from '@/server/app-settings';
import type {
  AdminHealthSnapshot,
  AdminMetricsComparison,
  AdminMetrics,
  BehaviorMetrics,
  EngineHealthStat,
  EngineUsage,
  FunnelMetrics,
  HealthMetrics,
} from '@/lib/admin/types';
import {
  ENGINE_USAGE_WINDOW_DAYS,
  HEALTH_WINDOW_HOURS,
  PENDING_STALE_MINUTES,
  buildEmptyMetrics,
  buildRange,
  coerceNumber,
  completedCondition,
  fillAmountSeries,
  fillDailySeries,
  mapAmountRows,
  mapCountRows,
  mapEngineUsage,
  refundedFailedCondition,
  resolveRange,
  safeQuery,
  toISO,
  unresolvedFailedCondition,
  type AdminMetricsOptions,
  type AmountRow,
  type BehaviorRow,
  type CountRow,
  type CountValueRow,
  type DurationRow,
  type EngineAggRow,
  type FailedEngineRow,
  type FunnelRow,
  type HealthRow,
  type ReturningRow,
  type SummaryRow,
  type WhaleRow,
} from '@/server/admin-metrics/admin-metrics-helpers';
export type { AdminMetrics, MetricsRangeLabel } from '@/lib/admin/types';
export {
  DEFAULT_METRIC_RANGE,
  METRIC_RANGE_OPTIONS,
  normalizeMetricsRange,
} from '@/server/admin-metrics/admin-metrics-helpers';

async function loadEngineUsageRows(excludedUserIds?: string[]): Promise<EngineAggRow[]> {
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

export async function fetchAdminMetrics(
  rangeParam?: string | null,
  options?: AdminMetricsOptions
): Promise<AdminMetrics> {
  const range = resolveRange(rangeParam);
  const excludedUserIds = (options?.excludeUserIds ?? []).map((userId) => userId.trim()).filter(Boolean);
  const hasExcludedUsers = excludedUserIds.length > 0;
  const exclusionParams = hasExcludedUsers ? [excludedUserIds] : undefined;
  const excludeUserIdClause = (column: string, options?: { allowNulls?: boolean }) => {
    if (!hasExcludedUsers) return '';
    if (options?.allowNulls) {
      return `AND (${column} IS NULL OR ${column} <> ALL($1::text[]))`;
    }
    return `AND ${column} <> ALL($1::text[])`;
  };

  if (!isDatabaseConfigured()) {
    return buildEmptyMetrics(range);
  }

  await ensureBillingSchema();

  const [
    signupDailyRows,
    activeDailyRows,
    topupDailyRows,
    chargeDailyRows,
    signupMonthlyRows,
    topupMonthlyRows,
    chargeMonthlyRows,
    totalUsersRow,
    payingAccountsRow,
    activeAccountsRow,
    topupSummaryRow,
    chargeSummaryRow,
    engineRows,
    funnelRows,
    signupTopupDurationRow,
    topupRenderDurationRow,
    behaviorStatsRow,
    returningRow,
    whalesRows,
    healthRow,
    failedByEngineRows,
  ] = await Promise.all([
    safeQuery<CountRow>(
      `
        SELECT date_trunc('day', created_at) AS bucket, COUNT(*)::bigint AS count
        FROM profiles
        WHERE synced_from_supabase
          ${excludeUserIdClause('id::text')}
          AND created_at >= NOW() - INTERVAL '${range.days} days'
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<CountRow>(
      `
        SELECT date_trunc('day', created_at) AS bucket, COUNT(DISTINCT user_id)::bigint AS count
        FROM app_jobs
        WHERE created_at >= NOW() - INTERVAL '${range.days} days'
          AND status = 'completed'
          AND user_id IS NOT NULL
          ${excludeUserIdClause('user_id')}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('day', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'topup'
          AND created_at >= NOW() - INTERVAL '${range.days} days'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('day', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'charge'
          AND created_at >= NOW() - INTERVAL '${range.days} days'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<CountRow>(
      `
        SELECT date_trunc('month', created_at) AS bucket, COUNT(*)::bigint AS count
        FROM profiles
        WHERE synced_from_supabase
          ${excludeUserIdClause('id::text')}
          AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('month', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'topup'
          AND created_at >= NOW() - INTERVAL '12 months'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('month', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'charge'
          AND created_at >= NOW() - INTERVAL '12 months'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<SummaryRow>(
      `
        SELECT COUNT(*)::bigint AS total
        FROM profiles
        WHERE synced_from_supabase
          ${excludeUserIdClause('id::text')}
        LIMIT 1
      `,
      exclusionParams
    ),
    safeQuery<SummaryRow>(
      `
        SELECT COUNT(DISTINCT user_id)::bigint AS total
        FROM app_receipts
        WHERE type = 'topup'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
      `,
      exclusionParams
    ),
    safeQuery<SummaryRow>(
      `
        SELECT COUNT(DISTINCT user_id)::bigint AS total
        FROM app_jobs
        WHERE status = 'completed'
          AND created_at >= NOW() - INTERVAL '30 days'
          AND user_id IS NOT NULL
          ${excludeUserIdClause('user_id')}
      `,
      exclusionParams
    ),
    safeQuery<SummaryRow>(
      `
        SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total
        FROM app_receipts
        WHERE type = 'topup'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
      `,
      exclusionParams
    ),
    safeQuery<SummaryRow>(
      `
        SELECT COALESCE(SUM(amount_cents), 0)::bigint AS total
        FROM app_receipts
        WHERE type = 'charge'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
      `,
      exclusionParams
    ),
    loadEngineUsageRows(excludedUserIds),
    safeQuery<FunnelRow>(
      `
        WITH first_topups AS (
          SELECT user_id, MIN(created_at) AS first_topup_at
          FROM app_receipts
          WHERE type = 'topup'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        ),
        first_renders AS (
          SELECT user_id, MIN(created_at) AS first_render_at
          FROM app_jobs
          WHERE status = 'completed'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        )
        SELECT
          COUNT(*)::bigint AS total_topup_users,
          COUNT(*) FILTER (
            WHERE fr.first_render_at IS NOT NULL
              AND fr.first_render_at >= ft.first_topup_at
              AND fr.first_render_at <= ft.first_topup_at + INTERVAL '30 days'
          )::bigint AS converted_within_30d
        FROM first_topups ft
        LEFT JOIN first_renders fr ON fr.user_id = ft.user_id
      `,
      exclusionParams
    ),
    safeQuery<DurationRow>(
      `
        WITH first_topups AS (
          SELECT user_id, MIN(created_at) AS first_topup_at
          FROM app_receipts
          WHERE type = 'topup'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        )
        SELECT
          AVG(EXTRACT(EPOCH FROM (ft.first_topup_at - p.created_at)) / 86400)::numeric AS avg_days
        FROM first_topups ft
        JOIN profiles p ON p.id::text = ft.user_id
        WHERE p.synced_from_supabase
          ${excludeUserIdClause('p.id::text')}
          AND p.created_at IS NOT NULL
          AND ft.first_topup_at >= p.created_at
      `,
      exclusionParams
    ),
    safeQuery<DurationRow>(
      `
        WITH first_topups AS (
          SELECT user_id, MIN(created_at) AS first_topup_at
          FROM app_receipts
          WHERE type = 'topup'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        ),
        first_renders AS (
          SELECT user_id, MIN(created_at) AS first_render_at
          FROM app_jobs
          WHERE status = 'completed'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        )
        SELECT
          AVG(EXTRACT(EPOCH FROM (fr.first_render_at - ft.first_topup_at)) / 86400)::numeric AS avg_days
        FROM first_topups ft
        JOIN first_renders fr ON fr.user_id = ft.user_id
        WHERE fr.first_render_at >= ft.first_topup_at
      `,
      exclusionParams
    ),
    safeQuery<BehaviorRow>(
      `
        WITH paying_users AS (
          SELECT DISTINCT user_id
          FROM app_receipts
          WHERE type = 'topup'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
        ),
        render_counts AS (
          SELECT j.user_id, COUNT(*)::bigint AS render_count
          FROM app_jobs j
          JOIN paying_users p ON p.user_id = j.user_id
          WHERE j.status = 'completed'
            AND j.created_at >= NOW() - INTERVAL '30 days'
            ${excludeUserIdClause('j.user_id')}
          GROUP BY j.user_id
        )
        SELECT
          AVG(render_count)::numeric AS avg_renders,
          PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY render_count) AS median_renders
        FROM render_counts
      `,
      exclusionParams
    ),
    safeQuery<ReturningRow>(
      `
        WITH current_window AS (
          SELECT DISTINCT user_id
          FROM app_jobs
          WHERE status = 'completed'
            AND user_id IS NOT NULL
            AND created_at >= NOW() - INTERVAL '7 days'
            ${excludeUserIdClause('user_id')}
        ),
        previous_window AS (
          SELECT DISTINCT user_id
          FROM app_jobs
          WHERE status = 'completed'
            AND user_id IS NOT NULL
            AND created_at >= NOW() - INTERVAL '14 days'
            AND created_at < NOW() - INTERVAL '7 days'
            ${excludeUserIdClause('user_id')}
        )
        SELECT COUNT(*)::bigint AS returning_count
        FROM (
          SELECT user_id FROM current_window
          INTERSECT
          SELECT user_id FROM previous_window
        ) overlap
      `,
      exclusionParams
    ),
    safeQuery<WhaleRow>(
      `
        WITH topup_totals AS (
          SELECT user_id, SUM(amount_cents)::bigint AS lifetime_topup_cents, MIN(created_at) AS first_topup_at
          FROM app_receipts
          WHERE type = 'topup'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        ),
        charge_totals AS (
          SELECT user_id, SUM(amount_cents)::bigint AS lifetime_charge_cents
          FROM app_receipts
          WHERE type = 'charge'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        ),
        job_stats AS (
          SELECT
            user_id,
            COUNT(*)::bigint AS render_count,
            MIN(created_at) AS first_render_at,
            MAX(created_at) AS last_render_at
          FROM app_jobs
          WHERE status = 'completed'
            ${excludeUserIdClause('user_id', { allowNulls: true })}
          GROUP BY user_id
        )
        SELECT
          t.user_id,
          t.lifetime_topup_cents,
          COALESCE(c.lifetime_charge_cents, 0)::bigint AS lifetime_charge_cents,
          COALESCE(j.render_count, 0)::bigint AS render_count,
          (
            SELECT MIN(val)
            FROM (VALUES (p.created_at), (t.first_topup_at), (j.first_render_at)) AS v(val)
            WHERE val IS NOT NULL
          ) AS first_seen_at,
          (
            SELECT MAX(val)
            FROM (VALUES (p.created_at), (t.first_topup_at), (j.last_render_at)) AS v(val)
            WHERE val IS NOT NULL
          ) AS last_active_at
        FROM topup_totals t
        LEFT JOIN charge_totals c ON c.user_id = t.user_id
        LEFT JOIN job_stats j ON j.user_id = t.user_id
        LEFT JOIN profiles p ON p.id::text = t.user_id AND p.synced_from_supabase
          ${excludeUserIdClause('p.id::text')}
        ORDER BY t.lifetime_topup_cents DESC
        LIMIT 10
      `,
      exclusionParams
    ),
    safeQuery<HealthRow>(
      `
        SELECT
          COUNT(*) FILTER (WHERE ${unresolvedFailedCondition('j')})::bigint AS failed_count,
          COUNT(*) FILTER (WHERE (${unresolvedFailedCondition('j')} OR ${completedCondition('j')}))::bigint AS total_count
        FROM app_jobs j
        WHERE created_at >= NOW() - INTERVAL '${range.days} days'
          ${excludeUserIdClause('j.user_id', { allowNulls: true })}
      `,
      exclusionParams
    ),
    safeQuery<FailedEngineRow>(
      `
        SELECT
          COALESCE(NULLIF(j.engine_id, ''), 'unknown') AS engine_id,
          COALESCE(NULLIF(j.engine_label, ''), COALESCE(NULLIF(j.engine_id, ''), 'unknown')) AS engine_label,
          COUNT(*) FILTER (WHERE ${unresolvedFailedCondition('j')})::bigint AS failed_count,
          COUNT(*) FILTER (WHERE (${unresolvedFailedCondition('j')} OR ${completedCondition('j')}))::bigint AS total_count
        FROM app_jobs j
        WHERE created_at >= NOW() - INTERVAL '${range.days} days'
          ${excludeUserIdClause('j.user_id', { allowNulls: true })}
        GROUP BY engine_id, engine_label
        HAVING COUNT(*) FILTER (WHERE (${unresolvedFailedCondition('j')} OR ${completedCondition('j')})) > 0
        ORDER BY failed_count DESC
      `,
      exclusionParams
    ),
  ]);

  const signupDaily = fillDailySeries(mapCountRows(signupDailyRows), range);
  const activeDaily = fillDailySeries(mapCountRows(activeDailyRows), range);
  const topupsDaily = fillAmountSeries(mapAmountRows(topupDailyRows), range);
  const chargesDaily = fillAmountSeries(mapAmountRows(chargeDailyRows), range);

  const totalAccounts = coerceNumber(totalUsersRow[0]?.total ?? 0);
  const payingAccounts = coerceNumber(payingAccountsRow[0]?.total ?? 0);
  const activeAccounts30d = coerceNumber(activeAccountsRow[0]?.total ?? 0);
  const allTimeTopUpsUsd = coerceNumber(topupSummaryRow[0]?.total ?? 0) / 100;
  const allTimeRenderChargesUsd = coerceNumber(chargeSummaryRow[0]?.total ?? 0) / 100;

  const engines = mapEngineUsage(engineRows);

  const funnelRow = funnelRows[0];
  const totalTopupUsers = coerceNumber(funnelRow?.total_topup_users ?? 0);
  const convertedWithin30d = coerceNumber(funnelRow?.converted_within_30d ?? 0);

  const funnels: FunnelMetrics = {
    signupToTopUpConversion: totalAccounts ? payingAccounts / totalAccounts : 0,
    totalTopupUsers,
    topUpToRenderConversion30d: totalTopupUsers ? convertedWithin30d / totalTopupUsers : 0,
    convertedWithin30dUsers: convertedWithin30d,
    avgTimeSignupToFirstTopUpDays:
      signupTopupDurationRow[0]?.avg_days != null ? Number(signupTopupDurationRow[0].avg_days) : null,
    avgTimeTopUpToFirstRenderDays:
      topupRenderDurationRow[0]?.avg_days != null ? Number(topupRenderDurationRow[0].avg_days) : null,
  };

  const behavior: BehaviorMetrics = {
    avgRendersPerPayingUser30d: behaviorStatsRow[0]?.avg_renders != null ? Number(behaviorStatsRow[0].avg_renders) : 0,
    medianRendersPerPayingUser30d:
      behaviorStatsRow[0]?.median_renders != null ? Number(behaviorStatsRow[0].median_renders) : 0,
    returningUsers7d: coerceNumber(returningRow[0]?.returning_count ?? 0),
    whalesTop10: whalesRows.map((row) => ({
      userId: row.user_id,
      identifier: row.user_id ? row.user_id.slice(0, 8) : 'unknown',
      lifetimeTopupUsd: coerceNumber(row.lifetime_topup_cents) / 100,
      lifetimeChargeUsd: coerceNumber(row.lifetime_charge_cents) / 100,
      renderCount: coerceNumber(row.render_count ?? 0),
      firstSeenAt: row.first_seen_at ? toISO(row.first_seen_at) : null,
      lastActiveAt: row.last_active_at ? toISO(row.last_active_at) : null,
    })),
  };

  const failedCount = coerceNumber(healthRow[0]?.failed_count ?? 0);
  const totalFailuresConsidered = coerceNumber(healthRow[0]?.total_count ?? 0);

  const health: HealthMetrics = {
    failedRenders30d: failedCount,
    failedRendersRate30d: totalFailuresConsidered ? failedCount / totalFailuresConsidered : 0,
    failedByEngine30d: failedByEngineRows.map((row) => {
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
    }),
  };

  return {
    totals: {
      totalAccounts,
      payingAccounts,
      activeAccounts30d,
      allTimeTopUpsUsd,
      allTimeRenderChargesUsd,
    },
    range,
    timeseries: {
      signupsDaily: signupDaily,
      activeAccountsDaily: activeDaily,
      topupsDaily,
      chargesDaily,
    },
    monthly: {
      signupsMonthly: mapCountRows(signupMonthlyRows),
      topupsMonthly: mapAmountRows(topupMonthlyRows),
      chargesMonthly: mapAmountRows(chargeMonthlyRows),
    },
    engines,
    funnels,
    behavior,
    health,
  };
}

type DailyComparisonSeries = AdminMetricsComparison['current'];

export async function fetchAdminMetricsComparison(
  rangeParam?: string | null,
  options?: AdminMetricsOptions
): Promise<AdminMetricsComparison> {
  const currentRange = resolveRange(rangeParam);
  const doubledRange = buildRange(currentRange.days * 2, currentRange.label);
  const excludedUserIds = (options?.excludeUserIds ?? []).map((userId) => userId.trim()).filter(Boolean);
  const hasExcludedUsers = excludedUserIds.length > 0;
  const exclusionParams = hasExcludedUsers ? [excludedUserIds] : undefined;
  const excludeUserIdClause = (column: string, clauseOptions?: { allowNulls?: boolean }) => {
    if (!hasExcludedUsers) return '';
    if (clauseOptions?.allowNulls) {
      return `AND (${column} IS NULL OR ${column} <> ALL($1::text[]))`;
    }
    return `AND ${column} <> ALL($1::text[])`;
  };

  if (!isDatabaseConfigured()) {
    const emptySeries: DailyComparisonSeries = {
      signupsDaily: fillDailySeries([], currentRange),
      activeAccountsDaily: fillDailySeries([], currentRange),
      topupsDaily: fillAmountSeries([], currentRange),
      chargesDaily: fillAmountSeries([], currentRange),
    };
    return {
      range: currentRange,
      current: emptySeries,
      previous: emptySeries,
    };
  }

  await ensureBillingSchema();

  const [signupDailyRows, activeDailyRows, topupDailyRows, chargeDailyRows] = await Promise.all([
    safeQuery<CountRow>(
      `
        SELECT date_trunc('day', created_at) AS bucket, COUNT(*)::bigint AS count
        FROM profiles
        WHERE synced_from_supabase
          ${excludeUserIdClause('id::text')}
          AND created_at >= NOW() - INTERVAL '${doubledRange.days} days'
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<CountRow>(
      `
        SELECT date_trunc('day', created_at) AS bucket, COUNT(DISTINCT user_id)::bigint AS count
        FROM app_jobs
        WHERE created_at >= NOW() - INTERVAL '${doubledRange.days} days'
          AND status = 'completed'
          AND user_id IS NOT NULL
          ${excludeUserIdClause('user_id')}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('day', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'topup'
          AND created_at >= NOW() - INTERVAL '${doubledRange.days} days'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('day', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'charge'
          AND created_at >= NOW() - INTERVAL '${doubledRange.days} days'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
        GROUP BY bucket
        ORDER BY bucket ASC
      `,
      exclusionParams
    ),
  ]);

  const splitCountSeries = (rows: CountRow[]) => {
    const filled = fillDailySeries(mapCountRows(rows), doubledRange);
    return {
      previous: filled.slice(0, currentRange.days),
      current: filled.slice(-currentRange.days),
    };
  };

  const splitAmountSeries = (rows: AmountRow[]) => {
    const filled = fillAmountSeries(mapAmountRows(rows), doubledRange);
    return {
      previous: filled.slice(0, currentRange.days),
      current: filled.slice(-currentRange.days),
    };
  };

  const signupSeries = splitCountSeries(signupDailyRows);
  const activeSeries = splitCountSeries(activeDailyRows);
  const topupSeries = splitAmountSeries(topupDailyRows);
  const chargeSeries = splitAmountSeries(chargeDailyRows);

  return {
    range: currentRange,
    current: {
      signupsDaily: signupSeries.current,
      activeAccountsDaily: activeSeries.current,
      topupsDaily: topupSeries.current,
      chargesDaily: chargeSeries.current,
    },
    previous: {
      signupsDaily: signupSeries.previous,
      activeAccountsDaily: activeSeries.previous,
      topupsDaily: topupSeries.previous,
      chargesDaily: chargeSeries.previous,
    },
  };
}

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

export async function fetchEngineUsageMetrics(): Promise<EngineUsage[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }
  await ensureBillingSchema();
  const rows = await loadEngineUsageRows();
  return mapEngineUsage(rows);
}
