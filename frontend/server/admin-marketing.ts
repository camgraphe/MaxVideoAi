import { isDatabaseConfigured, query } from '@/lib/db';

type MarketingOptInRow = {
  user_id: string;
  email: string | null;
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
        u.email,
        p.marketing_opt_in_at
      FROM profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      WHERE COALESCE(p.marketing_opt_in, FALSE) = TRUE
      ORDER BY p.marketing_opt_in_at DESC NULLS LAST
    `
  );

  return rows.map((row) => ({
    userId: row.user_id,
    email: row.email,
    optedInAt: row.marketing_opt_in_at ? row.marketing_opt_in_at.toISOString() : null,
  }));
}
