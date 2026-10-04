import { query } from '@/lib/db';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { adminReportingWindow } from '@/lib/admin/reporting-window';
import { ADMIN_EXCLUDED_USER_IDS } from '@/lib/admin/exclusions';
import { manualAdminCreditExclusionClause } from '@/server/admin-metrics/admin-topup-filter';
import { unresolvedFailedCondition } from '@/server/admin-metrics/admin-metrics-helpers';

import { readOverviewSources, scanRegistrations } from './admin-overview-read';
export type { OverviewUser } from './admin-overview-read';
export type OverviewReceipt = {
  id: number;
  userId: string | null;
  type: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};
export type AdminOverview = Awaited<ReturnType<typeof fetchAdminOverview>>;

export async function fetchAdminOverview(period?: string, excludeInternal = true) {
  const window = adminReportingWindow(period);
  const excludedUserIds = excludeInternal ? ADMIN_EXCLUDED_USER_IDS : [];
  const { users, finance } = await readOverviewSources({
    users: (signal) => loadRegistrations(window.from, window.to, signal, excludedUserIds),
    finance: async () => (process.env.DATABASE_URL ? loadFinance(window.from, window.to, excludedUserIds, excludeInternal) : null),
  });
  return { window, users, finance, excludeInternal, loadedAt: new Date().toISOString() };
}

async function loadRegistrations(from: string, to: string, signal: AbortSignal, excludedUserIds: string[]) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = getSupabaseAdmin();
  return scanRegistrations(from, to, signal, async (page) => {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    return data.users;
  }, new Set(excludedUserIds));
}

async function loadFinance(from: string, to: string, excludedUserIds: string[], excludeInternal: boolean) {
  const manualCreditClause = manualAdminCreditExclusionClause(excludeInternal);
  const [totals, recent, incidents] = await Promise.all([
    query<{ type: string; currency: string; count: string; cents: string }>(
      `SELECT type, currency, COUNT(*)::text AS count, SUM(amount_cents)::text AS cents FROM app_receipts
       WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
         AND (user_id IS NULL OR user_id <> ALL($3::text[])) ${manualCreditClause}
       GROUP BY type, currency`,
      [from, to, excludedUserIds]
    ),
    query<{
      id: number;
      user_id: string | null;
      type: string;
      amount_cents: number;
      currency: string;
      created_at: string;
    }>(
      `SELECT id, user_id, type, amount_cents, currency, created_at FROM app_receipts
       WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
         AND (user_id IS NULL OR user_id <> ALL($3::text[])) ${manualCreditClause}
       ORDER BY created_at DESC, id DESC LIMIT 8`,
      [from, to, excludedUserIds]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app_jobs j WHERE ${unresolvedFailedCondition('j')}
       AND j.created_at >= $1::timestamptz AND j.created_at < $2::timestamptz
       AND (j.user_id IS NULL OR j.user_id <> ALL($3::text[]))`,
      [from, to, excludedUserIds]
    ),
  ]);
  return {
    totals: totals.map((row) => ({
      type: row.type,
      currency: row.currency,
      count: Number(row.count),
      cents: Number(row.cents),
    })),
    recent: recent.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      amountCents: Number(row.amount_cents),
      currency: row.currency,
      createdAt: new Date(row.created_at).toISOString(),
    })),
    unresolvedFailures: Number(incidents[0]?.count ?? 0),
  };
}
