import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import { ensureBillingSchema } from '@/lib/schema';

export async function GET(req: NextRequest) {
  await ensureBillingSchema();
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await query<{ sum_30: string; sum_today: string }>(
    `SELECT
        COALESCE(
          SUM(
            CASE
              WHEN type = 'charge' THEN amount_cents
              WHEN type = 'refund' THEN -amount_cents
              ELSE 0
            END
          ),
          0
        )::bigint::text AS sum_30,
        COALESCE(
          SUM(
            CASE
              WHEN created_at >= now() - interval '1 day' THEN
                CASE
                  WHEN type = 'charge' THEN amount_cents
                  WHEN type = 'refund' THEN -amount_cents
                  ELSE 0
                END
              ELSE 0
            END
          ),
          0
        )::bigint::text AS sum_today
     FROM app_receipts
     WHERE user_id = $1 AND created_at >= now() - interval '30 days'`,
    [userId]
  );
  const spent30 = Number(rows[0]?.sum_30 ?? '0');
  const spentToday = Number(rows[0]?.sum_today ?? '0');

  let tier: 'Member' | 'Plus' | 'Pro' = 'Member';
  let savingsPct = 0;
  if (spent30 >= 20000) {
    tier = 'Pro';
    savingsPct = 10;
  } else if (spent30 >= 5000) {
    tier = 'Plus';
    savingsPct = 5;
  }

  return NextResponse.json({
    tier,
    savingsPct,
    spent30: spent30 / 100,
    spentToday: spentToday / 100,
  });
}
