import { isDatabaseConfigured, query } from '@/lib/db';
import { getUserIdentity } from '@/server/supabase-admin';

type MarketingOptInRow = {
  user_id: string;
  marketing_opt_in_at: Date | null;
};

export type MarketingOptInRecord = {
  userId: string;
  email: string | null;
  optedInAt: string | null;
};

export async function fetchMarketingOptIns(): Promise<MarketingOptInRecord[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  const rows = await query<MarketingOptInRow>(
    `
      SELECT
        p.id AS user_id,
        p.marketing_opt_in_at
      FROM profiles p
      WHERE COALESCE(p.marketing_opt_in, FALSE) = TRUE
      ORDER BY p.marketing_opt_in_at DESC NULLS LAST
    `
  );

  const emailMap = new Map<string, string | null>();
  const ids = rows.map((row) => row.user_id);
  if (ids.length && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    await Promise.all(
      ids.map(async (userId) => {
        try {
          const identity = await getUserIdentity(userId);
          emailMap.set(userId, identity?.email ?? null);
        } catch (error) {
          console.warn('[admin-marketing] failed to resolve email', userId, error);
          emailMap.set(userId, null);
        }
      })
    );
  }

  return rows.map((row) => ({
    userId: row.user_id,
    email: emailMap.get(row.user_id) ?? null,
    optedInAt: row.marketing_opt_in_at ? row.marketing_opt_in_at.toISOString() : null,
  }));
}
