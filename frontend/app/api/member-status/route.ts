import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import { ensureBillingSchema } from '@/lib/schema';
import { getMembershipTiers } from '@/lib/membership';

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const databaseConfigured = isDatabaseConfigured();
  if (!databaseConfigured) {
    return NextResponse.json({ tier: 'Member', savingsPct: 0, spent30: 0, spentToday: 0, mock: true });
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/member-status] schema init failed, returning defaults', error);
    return NextResponse.json({ tier: 'Member', savingsPct: 0, spent30: 0, spentToday: 0, mock: true });
  }

  let rows: Array<{ sum_30: string; sum_today: string }>;
  try {
    rows = await query<{ sum_30: string; sum_today: string }>(
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
  } catch (error) {
    console.warn('[api/member-status] query failed, returning defaults', error);
    return NextResponse.json({ tier: 'Member', savingsPct: 0, spent30: 0, spentToday: 0, mock: true });
  }
  const spent30 = Number(rows[0]?.sum_30 ?? '0');
  const spentToday = Number(rows[0]?.sum_today ?? '0');

  const tierConfigs = await getMembershipTiers();
  let activeTier = tierConfigs[0];
  for (const tier of tierConfigs) {
    if (spent30 >= tier.spendThresholdCents) {
      activeTier = tier;
    }
  }
  const tierLabel = activeTier?.tier ? `${activeTier.tier.slice(0, 1).toUpperCase()}${activeTier.tier.slice(1)}` : 'Member';
  const savingsPct = Math.round((activeTier?.discountPercent ?? 0) * 100);

  return NextResponse.json({
    tier: tierLabel,
    savingsPct,
    spent30: spent30 / 100,
    spentToday: spentToday / 100,
  });
}
