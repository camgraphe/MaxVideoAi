import { query } from '@/lib/db';
import { getWalletBalanceCents } from '@/lib/wallet';
import { getSupabaseAdmin } from '@/server/supabase-admin';
import { isUserAdmin } from '@/server/admin';

type WalletAggregateRow = {
  type: string;
  total: number | string | null;
};

type EngineBreakdownRow = {
  engine_label: string | null;
  engine_id: string | null;
  render_count: number | string | null;
  spend_cents: number | string | null;
};

type RecentJobRow = {
  job_id: string;
  engine_label: string | null;
  status: string | null;
  created_at: string;
  final_price_cents: number | string | null;
  video_url: string | null;
};

type TopupRow = {
  id: number;
  amount_cents: number | string | null;
  currency: string | null;
  created_at: string;
  description: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
};

type CountRow = {
  count: number | string | null;
};

function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const hasDatabase = Boolean((process.env.DATABASE_URL ?? '').trim());
const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim());

export type AdminUserProfile = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  appMetadata: Record<string, unknown> | null;
  userMetadata: Record<string, unknown> | null;
  isAdmin: boolean;
};

export type AdminUserUsage = {
  totalRenders: number;
  renders30d: number;
  engineBreakdown: Array<{ engineLabel: string; renderCount: number; spendUsd: number }>;
  recentJobs: Array<{
    jobId: string;
    engineLabel: string;
    status: string | null;
    createdAt: string;
    amountUsd: number;
    videoUrl: string | null;
  }>;
};

export type AdminUserWallet = {
  balanceCents: number;
  stats: Record<string, number>;
};

export type AdminUserTopup = {
  id: number;
  amountUsd: number;
  currency: string;
  createdAt: string;
  description: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
};

export type AdminUserOverview = {
  profile: AdminUserProfile | null;
  wallet: AdminUserWallet | null;
  usage: AdminUserUsage | null;
  topups: AdminUserTopup[];
  serviceRoleConfigured: boolean;
};

export async function fetchAdminUserOverview(userId: string): Promise<AdminUserOverview> {
  const [profile, wallet, usage, topups] = await Promise.all([
    fetchProfile(userId),
    fetchWallet(userId),
    fetchUsage(userId),
    fetchTopups(userId),
  ]);

  return {
    profile,
    wallet,
    usage,
    topups,
    serviceRoleConfigured: hasServiceRole,
  };
}

async function fetchProfile(userId: string): Promise<AdminUserProfile | null> {
  if (!hasServiceRole) return null;
  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) {
      return null;
    }
    const user = data.user;
    const isAdminUser = await isUserAdmin(user.id);
    return {
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at,
      appMetadata: user.app_metadata,
      userMetadata: user.user_metadata,
      isAdmin: isAdminUser,
    };
  } catch (error) {
    console.warn('[admin-users] failed to fetch profile', error);
    return null;
  }
}

async function fetchWallet(userId: string): Promise<AdminUserWallet | null> {
  if (!hasDatabase) return null;
  try {
    const { balanceCents } = await getWalletBalanceCents(userId);
    const aggregates = await query<WalletAggregateRow>(
      `
        SELECT type, COALESCE(SUM(amount_cents), 0)::bigint AS total
        FROM app_receipts
        WHERE user_id = $1
        GROUP BY type
      `,
      [userId]
    );
    const stats = aggregates.reduce<Record<string, number>>((acc, row) => {
      acc[row.type] = coerceNumber(row.total);
      return acc;
    }, {});
    return { balanceCents, stats };
  } catch (error) {
    console.warn('[admin-users] failed to load wallet', error);
    return null;
  }
}

async function fetchUsage(userId: string): Promise<AdminUserUsage | null> {
  if (!hasDatabase) return null;
  try {
    const [totalRows, recentRows, engineRows, jobRows] = await Promise.all([
      query<CountRow>(`SELECT COUNT(*)::bigint AS count FROM app_jobs WHERE user_id = $1 AND status = 'completed'`, [userId]),
      query<CountRow>(
        `SELECT COUNT(*)::bigint AS count FROM app_jobs WHERE user_id = $1 AND status = 'completed' AND created_at >= NOW() - INTERVAL '30 days'`,
        [userId]
      ),
      query<EngineBreakdownRow>(
        `
          SELECT
            COALESCE(NULLIF(engine_label, ''), COALESCE(NULLIF(engine_id, ''), 'unknown')) AS engine_label,
            engine_id,
            COUNT(*)::bigint AS render_count,
            COALESCE(SUM(final_price_cents), 0)::bigint AS spend_cents
          FROM app_jobs
          WHERE user_id = $1
            AND status = 'completed'
          GROUP BY engine_label, engine_id
          ORDER BY spend_cents DESC
        `,
        [userId]
      ),
      query<RecentJobRow>(
        `
          SELECT
            job_id,
            COALESCE(NULLIF(engine_label, ''), COALESCE(NULLIF(engine_id, ''), 'unknown')) AS engine_label,
            status,
            created_at,
            final_price_cents,
            video_url
          FROM app_jobs
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT 10
        `,
        [userId]
      ),
    ]);

    const engineBreakdown = engineRows.map((row) => ({
      engineLabel: row.engine_label ?? 'Unknown',
      renderCount: coerceNumber(row.render_count),
      spendUsd: coerceNumber(row.spend_cents) / 100,
    }));

    const recentJobs = jobRows.map((row) => ({
      jobId: row.job_id,
      engineLabel: row.engine_label ?? 'Unknown',
      status: row.status,
      createdAt: row.created_at,
      amountUsd: coerceNumber(row.final_price_cents) / 100,
      videoUrl: row.video_url,
    }));

    return {
      totalRenders: coerceNumber(totalRows[0]?.count ?? 0),
      renders30d: coerceNumber(recentRows[0]?.count ?? 0),
      engineBreakdown,
      recentJobs,
    };
  } catch (error) {
    console.warn('[admin-users] failed to load usage', error);
    return null;
  }
}

async function fetchTopups(userId: string): Promise<AdminUserTopup[]> {
  if (!hasDatabase) return [];
  try {
    const rows = await query<TopupRow>(
      `
        SELECT
          id,
          amount_cents,
          currency,
          created_at,
          description,
          stripe_payment_intent_id,
          stripe_charge_id
        FROM app_receipts
        WHERE user_id = $1
          AND type = 'topup'
        ORDER BY created_at DESC
        LIMIT 20
      `,
      [userId]
    );
    return rows.map((row) => ({
      id: row.id,
      amountUsd: coerceNumber(row.amount_cents) / 100,
      currency: (row.currency ?? 'USD').toUpperCase(),
      createdAt: row.created_at,
      description: row.description,
      stripePaymentIntentId: row.stripe_payment_intent_id,
      stripeChargeId: row.stripe_charge_id,
    }));
  } catch (error) {
    console.warn('[admin-users] failed to load topups', error);
    return [];
  }
}
