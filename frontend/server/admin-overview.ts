import { query } from '@/lib/db';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { adminReportingWindow } from '@/lib/admin/reporting-window';
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

export async function fetchAdminOverview(period?: string) {
  const window = adminReportingWindow(period);
  const { users, finance } = await readOverviewSources({
    users: (signal) => loadRegistrations(window.from, window.to, signal),
    finance: async () => (process.env.DATABASE_URL ? loadFinance(window.from, window.to) : null),
  });
  return { window, users, finance, loadedAt: new Date().toISOString() };
}

async function loadRegistrations(from: string, to: string, signal: AbortSignal) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = getSupabaseAdmin();
  return scanRegistrations(from, to, signal, async (page) => {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    return data.users;
  });
}

async function loadFinance(from: string, to: string) {
  const [totals, recent, incidents] = await Promise.all([
    query<{ type: string; currency: string; count: string; cents: string }>(
      `SELECT type, currency, COUNT(*)::text AS count, SUM(amount_cents)::text AS cents FROM app_receipts
       WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz GROUP BY type, currency`,
      [from, to]
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
       WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz ORDER BY created_at DESC, id DESC LIMIT 8`,
      [from, to]
    ),
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM app_jobs j WHERE ${unresolvedFailedCondition('j')}
       AND j.created_at >= $1::timestamptz AND j.created_at < $2::timestamptz`,
      [from, to]
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
