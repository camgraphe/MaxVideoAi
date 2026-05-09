import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import type { AdminMetrics } from '@/lib/admin/types';
import { loadEngineUsageRows } from '@/server/admin-metrics/admin-metrics-engine-usage';
import {
  buildBehaviorMetrics,
  buildFunnelMetrics,
  buildHealthMetrics,
} from '@/server/admin-metrics/admin-metrics-shaping';
import {
  buildEmptyMetrics,
  coerceNumber,
  completedCondition,
  fillAmountSeries,
  fillDailySeries,
  mapAmountRows,
  mapCountRows,
  mapEngineUsage,
  resolveRange,
  safeQuery,
  unresolvedFailedCondition,
  type AdminMetricsOptions,
  type AmountRow,
  type BehaviorRow,
  type CountRow,
  type DurationRow,
  type FailedEngineRow,
  type FunnelRow,
  type HealthRow,
  type ReturningRow,
  type SummaryRow,
  type WhaleRow,
} from '@/server/admin-metrics/admin-metrics-helpers';

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
  const funnels = buildFunnelMetrics({
    totalAccounts,
    payingAccounts,
    funnelRows,
    signupTopupDurationRows: signupTopupDurationRow,
    topupRenderDurationRows: topupRenderDurationRow,
  });
  const behavior = buildBehaviorMetrics(behaviorStatsRow, returningRow, whalesRows);
  const health = buildHealthMetrics(healthRow, failedByEngineRows);

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
