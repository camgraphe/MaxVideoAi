import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getServiceNoticeSetting } from '@/server/app-settings';
import type {
  AdminHealthSnapshot,
  AdminMetrics,
  AmountSeriesPoint,
  BehaviorMetrics,
  EngineHealthStat,
  EngineUsage,
  FunnelMetrics,
  HealthMetrics,
  MetricsRange,
  MetricsRangeLabel,
  MonthlyAmountPoint,
  MonthlyPoint,
  TimeSeriesPoint,
  WhaleUser,
} from '@/lib/admin/types';
export type { AdminMetrics, MetricsRangeLabel } from '@/lib/admin/types';

type AdminMetricsOptions = {
  excludeUserIds?: string[];
};

type CountRow = {
  bucket: Date | string;
  count: number | string | null;
};

type AmountRow = CountRow & {
  amount_cents: number | string | null;
};

type SummaryRow = {
  total: number | string | null;
};

type EngineAggRow = {
  engine_id: string | null;
  engine_label: string | null;
  render_count: number | string | null;
  user_count: number | string | null;
  amount_cents: number | string | null;
};

type FunnelRow = {
  total_topup_users: number | string | null;
  converted_within_30d: number | string | null;
};

type DurationRow = {
  avg_days: number | string | null;
};

type BehaviorRow = {
  avg_renders: number | string | null;
  median_renders: number | string | null;
};

type ReturningRow = {
  returning_count: number | string | null;
};

type CountValueRow = {
  count: number | string | null;
};

type WhaleRow = {
  user_id: string;
  lifetime_topup_cents: number | string | null;
  lifetime_charge_cents: number | string | null;
  render_count: number | string | null;
  first_seen_at: Date | string | null;
  last_active_at: Date | string | null;
};

type HealthRow = {
  failed_count: number | string | null;
  total_count: number | string | null;
};

type FailedEngineRow = {
  engine_id: string | null;
  engine_label: string | null;
  failed_count: number | string | null;
  total_count: number | string | null;
};

const RANGE_DAYS: Record<MetricsRangeLabel, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const HEALTH_WINDOW_HOURS = 24;
const PENDING_STALE_MINUTES = 15;
const ENGINE_USAGE_WINDOW_DAYS = 30;

export const METRIC_RANGE_OPTIONS: MetricsRangeLabel[] = ['7d', '30d', '90d'];
export const DEFAULT_METRIC_RANGE: MetricsRangeLabel = '30d';

export function normalizeMetricsRange(candidate?: string | null): MetricsRangeLabel {
  if (!candidate) {
    return DEFAULT_METRIC_RANGE;
  }
  const normalized = candidate.trim().toLowerCase();
  if (normalized.startsWith('7')) {
    return '7d';
  }
  if (normalized.startsWith('9')) {
    return '90d';
  }
  if (normalized.startsWith('30')) {
    return '30d';
  }
  return DEFAULT_METRIC_RANGE;
}

function resolveRange(candidate?: string | null): MetricsRange {
  const label = normalizeMetricsRange(candidate);
  const days = RANGE_DAYS[label];
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const rangeStart = new Date(todayStart);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - (days - 1));
  return {
    label,
    days,
    from: rangeStart.toISOString(),
    to: now.toISOString(),
  };
}

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function buildDailyBuckets(range: MetricsRange): string[] {
  const buckets: string[] = [];
  const todayStart = startOfUtcDay(new Date());
  const start = new Date(todayStart);
  start.setUTCDate(start.getUTCDate() - (range.days - 1));
  for (let i = 0; i < range.days; i += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + i);
    buckets.push(current.toISOString());
  }
  return buckets;
}

function toISO(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function safeQuery<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch (error) {
    console.warn('[admin-metrics] query failed', {
      sql,
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }
}

function mapCountRows(rows: CountRow[]): TimeSeriesPoint[] {
  return rows
    .map((row) => ({
      date: toISO(row.bucket),
      value: coerceNumber(row.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function mapAmountRows(rows: AmountRow[]): AmountSeriesPoint[] {
  return rows
    .map((row) => ({
      date: toISO(row.bucket),
      count: coerceNumber(row.count),
      amountCents: coerceNumber(row.amount_cents),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function fillDailySeries(points: TimeSeriesPoint[], range: MetricsRange): TimeSeriesPoint[] {
  const buckets = buildDailyBuckets(range);
  const map = new Map(points.map((point) => [point.date.slice(0, 10), point.value]));
  return buckets.map((iso) => {
    const key = iso.slice(0, 10);
    return {
      date: iso,
      value: map.get(key) ?? 0,
    };
  });
}

function fillAmountSeries(points: AmountSeriesPoint[], range: MetricsRange): AmountSeriesPoint[] {
  const buckets = buildDailyBuckets(range);
  const map = new Map(points.map((point) => [point.date.slice(0, 10), point]));
  return buckets.map((iso) => {
    const key = iso.slice(0, 10);
    const entry = map.get(key);
    if (entry) {
      return { date: iso, count: entry.count, amountCents: entry.amountCents };
    }
    return { date: iso, count: 0, amountCents: 0 };
  });
}

function buildEmptyMetrics(range: MetricsRange): AdminMetrics {
  return {
    totals: {
      totalAccounts: 0,
      payingAccounts: 0,
      activeAccounts30d: 0,
      allTimeTopUpsUsd: 0,
      allTimeRenderChargesUsd: 0,
    },
    range,
    timeseries: {
      signupsDaily: fillDailySeries([], range),
      activeAccountsDaily: fillDailySeries([], range),
      topupsDaily: fillAmountSeries([], range),
      chargesDaily: fillAmountSeries([], range),
    },
    monthly: {
      signupsMonthly: [],
      topupsMonthly: [],
      chargesMonthly: [],
    },
    engines: [],
    funnels: {
      signupToTopUpConversion: 0,
      topUpToRenderConversion30d: 0,
      avgTimeSignupToFirstTopUpDays: null,
      avgTimeTopUpToFirstRenderDays: null,
    },
    behavior: {
      avgRendersPerPayingUser30d: 0,
      medianRendersPerPayingUser30d: 0,
      returningUsers7d: 0,
      whalesTop10: [],
    },
    health: {
      failedRenders30d: 0,
      failedRendersRate30d: 0,
      failedByEngine30d: [],
    },
  };
}

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

function mapEngineUsage(rows: EngineAggRow[]): EngineUsage[] {
  const renderTotal = rows.reduce((sum, row) => sum + coerceNumber(row.render_count), 0);
  const revenueTotalCents = rows.reduce((sum, row) => sum + coerceNumber(row.amount_cents), 0);

  return rows.map((row) => {
    const renderCount = coerceNumber(row.render_count);
    const distinctUsers = coerceNumber(row.user_count);
    const amountCents = coerceNumber(row.amount_cents);
    const amountUsd = amountCents / 100;
    const engineId = row.engine_id ?? 'unknown';
    const engineLabel = row.engine_label ?? engineId;
    return {
      engineId,
      engineLabel,
      rendersCount30d: renderCount,
      rendersAmount30dUsd: amountUsd,
      distinctUsers30d: distinctUsers,
      shareOfTotalRenders30d: renderTotal ? renderCount / renderTotal : 0,
      shareOfTotalRevenue30d: revenueTotalCents ? amountCents / revenueTotalCents : 0,
      avgSpendPerUser30d: distinctUsers ? amountUsd / distinctUsers : 0,
    };
  });
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
          COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
          COUNT(*) FILTER (WHERE status IN ('failed', 'completed'))::bigint AS total_count
        FROM app_jobs
        WHERE created_at >= NOW() - INTERVAL '30 days'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
      `,
      exclusionParams
    ),
    safeQuery<FailedEngineRow>(
      `
        SELECT
          COALESCE(NULLIF(engine_id, ''), 'unknown') AS engine_id,
          COALESCE(NULLIF(engine_label, ''), COALESCE(NULLIF(engine_id, ''), 'unknown')) AS engine_label,
          COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
          COUNT(*) FILTER (WHERE status IN ('failed', 'completed'))::bigint AS total_count
        FROM app_jobs
        WHERE created_at >= NOW() - INTERVAL '30 days'
          ${excludeUserIdClause('user_id', { allowNulls: true })}
        GROUP BY engine_id, engine_label
        HAVING COUNT(*) FILTER (WHERE status IN ('failed', 'completed')) > 0
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
    topUpToRenderConversion30d: totalTopupUsers ? convertedWithin30d / totalTopupUsers : 0,
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
      stalePendingJobs: 0,
      serviceNotice,
      engineStats: [],
    };
  }

  const [failedRows, pendingRows, engineRows] = await Promise.all([
    safeQuery<CountValueRow>(
      `
        SELECT COUNT(*)::bigint AS count
        FROM app_jobs
        WHERE status = 'failed'
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
          COALESCE(NULLIF(engine_id, ''), 'unknown') AS engine_id,
          COALESCE(NULLIF(engine_label, ''), COALESCE(NULLIF(engine_id, ''), 'unknown')) AS engine_label,
          COUNT(*) FILTER (WHERE status = 'failed')::bigint AS failed_count,
          COUNT(*) FILTER (WHERE status IN ('failed', 'completed'))::bigint AS total_count
        FROM app_jobs
        WHERE created_at >= NOW() - INTERVAL '${HEALTH_WINDOW_HOURS} hours'
        GROUP BY engine_id, engine_label
        HAVING COUNT(*) FILTER (WHERE status IN ('failed', 'completed')) > 0
      `
    ),
  ]);

  const failedRenders24h = coerceNumber(failedRows[0]?.count ?? 0);
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
