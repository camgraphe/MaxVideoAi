import { query } from '@/lib/db';
import type {
  AdminMetrics,
  AmountSeriesPoint,
  EngineUsage,
  MetricsRange,
  MetricsRangeLabel,
  TimeSeriesPoint,
} from '@/lib/admin/types';

export type AdminMetricsOptions = {
  excludeUserIds?: string[];
};

export type CountRow = {
  bucket: Date | string;
  count: number | string | null;
};

export type AmountRow = CountRow & {
  amount_cents: number | string | null;
};

export type SummaryRow = {
  total: number | string | null;
};

export type EngineAggRow = {
  engine_id: string | null;
  engine_label: string | null;
  render_count: number | string | null;
  user_count: number | string | null;
  amount_cents: number | string | null;
};

export type FunnelRow = {
  total_topup_users: number | string | null;
  converted_within_30d: number | string | null;
};

export type DurationRow = {
  avg_days: number | string | null;
};

export type BehaviorRow = {
  avg_renders: number | string | null;
  median_renders: number | string | null;
};

export type ReturningRow = {
  returning_count: number | string | null;
};

export type CountValueRow = {
  count: number | string | null;
};

export type WhaleRow = {
  user_id: string;
  lifetime_topup_cents: number | string | null;
  lifetime_charge_cents: number | string | null;
  render_count: number | string | null;
  first_seen_at: Date | string | null;
  last_active_at: Date | string | null;
};

export type HealthRow = {
  failed_count: number | string | null;
  total_count: number | string | null;
};

export type FailedEngineRow = {
  engine_id: string | null;
  engine_label: string | null;
  failed_count: number | string | null;
  total_count: number | string | null;
};

const RANGE_DAYS: Record<MetricsRangeLabel, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export const HEALTH_WINDOW_HOURS = 24;
export const PENDING_STALE_MINUTES = 15;
export const ENGINE_USAGE_WINDOW_DAYS = 30;
export const METRIC_RANGE_OPTIONS: MetricsRangeLabel[] = ['24h', '7d', '30d', '90d'];
export const DEFAULT_METRIC_RANGE: MetricsRangeLabel = '30d';

export function unresolvedFailedCondition(alias: string): string {
  return `(
    LOWER(COALESCE(${alias}.status, '')) IN ('failed', 'error', 'errored', 'cancelled', 'canceled', 'aborted')
    AND COALESCE(${alias}.payment_status, '') NOT ILIKE '%refunded%'
    AND NOT EXISTS (
      SELECT 1
      FROM app_receipts refund_receipts
      WHERE refund_receipts.job_id = ${alias}.job_id
        AND refund_receipts.type = 'refund'
    )
  )`;
}

export function refundedFailedCondition(alias: string): string {
  return `(
    LOWER(COALESCE(${alias}.status, '')) IN ('failed', 'error', 'errored', 'cancelled', 'canceled', 'aborted')
    AND (
      COALESCE(${alias}.payment_status, '') ILIKE '%refunded%'
      OR EXISTS (
        SELECT 1
        FROM app_receipts refund_receipts
        WHERE refund_receipts.job_id = ${alias}.job_id
          AND refund_receipts.type = 'refund'
      )
    )
  )`;
}

export function completedCondition(alias: string): string {
  return `LOWER(COALESCE(${alias}.status, '')) IN ('completed', 'success', 'succeeded', 'finished')`;
}

export function normalizeMetricsRange(candidate?: string | null): MetricsRangeLabel {
  if (!candidate) {
    return DEFAULT_METRIC_RANGE;
  }
  const normalized = candidate.trim().toLowerCase();
  if (normalized === '24h' || normalized.startsWith('24') || normalized === '1d') {
    return '24h';
  }
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

export function resolveRange(candidate?: string | null): MetricsRange {
  const label = normalizeMetricsRange(candidate);
  const days = RANGE_DAYS[label];
  return buildRange(days, label);
}

export function buildRange(days: number, label: MetricsRangeLabel): MetricsRange {
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

export function toISO(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function safeQuery<T>(sql: string, params?: ReadonlyArray<unknown>): Promise<T[]> {
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

export function mapCountRows(rows: CountRow[]): TimeSeriesPoint[] {
  return rows
    .map((row) => ({
      date: toISO(row.bucket),
      value: coerceNumber(row.count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function mapAmountRows(rows: AmountRow[]): AmountSeriesPoint[] {
  return rows
    .map((row) => ({
      date: toISO(row.bucket),
      count: coerceNumber(row.count),
      amountCents: coerceNumber(row.amount_cents),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function fillDailySeries(points: TimeSeriesPoint[], range: MetricsRange): TimeSeriesPoint[] {
  if (range.days === 1) {
    return [
      {
        date: range.to,
        value: points.reduce((sum, point) => sum + point.value, 0),
      },
    ];
  }

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

export function fillAmountSeries(points: AmountSeriesPoint[], range: MetricsRange): AmountSeriesPoint[] {
  if (range.days === 1) {
    return [
      {
        date: range.to,
        count: points.reduce((sum, point) => sum + point.count, 0),
        amountCents: points.reduce((sum, point) => sum + point.amountCents, 0),
      },
    ];
  }

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

export function buildEmptyMetrics(range: MetricsRange): AdminMetrics {
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
      totalTopupUsers: 0,
      topUpToRenderConversion30d: 0,
      convertedWithin30dUsers: 0,
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

export function mapEngineUsage(rows: EngineAggRow[]): EngineUsage[] {
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
