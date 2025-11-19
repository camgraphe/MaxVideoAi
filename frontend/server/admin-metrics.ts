import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

type CountRow = {
  bucket: Date | string;
  count: number | string;
};

type AmountRow = CountRow & {
  amount_cents: number | string | null;
};

type SummaryRow = {
  total: number | string | null;
};

export type TimeSeriesPoint = {
  date: string;
  value: number;
};

export type AmountSeriesPoint = {
  date: string;
  count: number;
  amountCents: number;
};

export type AdminMetrics = {
  signupDaily: TimeSeriesPoint[];
  signupMonthly: TimeSeriesPoint[];
  topupDaily: AmountSeriesPoint[];
  topupMonthly: AmountSeriesPoint[];
  chargeDaily: AmountSeriesPoint[];
  summary: {
    totalUsers: number;
    totalTopupVolumeCents: number;
    totalTopupCount: number;
    totalChargeVolumeCents: number;
    totalChargeCount: number;
  };
};

const EMPTY_METRICS: AdminMetrics = {
  signupDaily: [],
  signupMonthly: [],
  topupDaily: [],
  topupMonthly: [],
  chargeDaily: [],
  summary: {
    totalUsers: 0,
    totalTopupVolumeCents: 0,
    totalTopupCount: 0,
    totalChargeVolumeCents: 0,
    totalChargeCount: 0,
  },
};

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

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  if (!isDatabaseConfigured()) {
    return EMPTY_METRICS;
  }

  await ensureBillingSchema();

  const [
    signupDailyRows,
    signupMonthlyRows,
    topupDailyRows,
    topupMonthlyRows,
    chargeDailyRows,
    totalUsersRow,
    topupSummaryRow,
    chargeSummaryRow,
  ] = await Promise.all([
    safeQuery<CountRow>(
      `
        SELECT date_trunc('day', created_at) AS bucket, COUNT(*)::bigint AS count
        FROM profiles
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY bucket
        ORDER BY bucket ASC
      `
    ),
    safeQuery<CountRow>(
      `
        SELECT date_trunc('month', created_at) AS bucket, COUNT(*)::bigint AS count
        FROM profiles
        WHERE created_at >= NOW() - INTERVAL '12 months'
        GROUP BY bucket
        ORDER BY bucket ASC
      `
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('day', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'topup'
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY bucket
        ORDER BY bucket ASC
      `
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
        GROUP BY bucket
        ORDER BY bucket ASC
      `
    ),
    safeQuery<AmountRow>(
      `
        SELECT
          date_trunc('day', created_at) AS bucket,
          COUNT(*)::bigint AS count,
          COALESCE(SUM(amount_cents), 0)::bigint AS amount_cents
        FROM app_receipts
        WHERE type = 'charge'
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY bucket
        ORDER BY bucket ASC
      `
    ),
    safeQuery<SummaryRow>(`SELECT COUNT(*)::bigint AS total FROM profiles LIMIT 1`),
    safeQuery<SummaryRow>(
      `
        SELECT
          COALESCE(SUM(amount_cents), 0)::bigint AS total
        FROM app_receipts
        WHERE type = 'topup'
      `
    ),
    safeQuery<SummaryRow>(
      `
        SELECT
          COALESCE(SUM(amount_cents), 0)::bigint AS total
        FROM app_receipts
        WHERE type = 'charge'
      `
    ),
  ]);

  const topupCountRow = await safeQuery<SummaryRow>(
    `SELECT COUNT(*)::bigint AS total FROM app_receipts WHERE type = 'topup'`
  );
  const chargeCountRow = await safeQuery<SummaryRow>(
    `SELECT COUNT(*)::bigint AS total FROM app_receipts WHERE type = 'charge'`
  );

  return {
    signupDaily: mapCountRows(signupDailyRows),
    signupMonthly: mapCountRows(signupMonthlyRows),
    topupDaily: mapAmountRows(topupDailyRows),
    topupMonthly: mapAmountRows(topupMonthlyRows),
    chargeDaily: mapAmountRows(chargeDailyRows),
    summary: {
      totalUsers: coerceNumber(totalUsersRow[0]?.total ?? 0),
      totalTopupVolumeCents: coerceNumber(topupSummaryRow[0]?.total ?? 0),
      totalTopupCount: coerceNumber(topupCountRow[0]?.total ?? 0),
      totalChargeVolumeCents: coerceNumber(chargeSummaryRow[0]?.total ?? 0),
      totalChargeCount: coerceNumber(chargeCountRow[0]?.total ?? 0),
    },
  };
}
