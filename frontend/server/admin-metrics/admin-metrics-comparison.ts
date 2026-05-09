import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import type { AdminMetricsComparison } from '@/lib/admin/types';
import {
  buildRange,
  fillAmountSeries,
  fillDailySeries,
  mapAmountRows,
  mapCountRows,
  resolveRange,
  safeQuery,
  type AdminMetricsOptions,
  type AmountRow,
  type CountRow,
} from '@/server/admin-metrics/admin-metrics-helpers';

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
