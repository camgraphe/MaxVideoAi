import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { getUserIdFromRequest } from '@/lib/user';
import { ensureBillingSchema } from '@/lib/schema';
import { getMembershipTiers } from '@/lib/membership';

const FALLBACK_TIERS = [
  { tier: 'member', spendThresholdCents: 0, discountPercent: 0 },
  { tier: 'plus', spendThresholdCents: 5_000, discountPercent: 0.05 },
  { tier: 'pro', spendThresholdCents: 20_000, discountPercent: 0.1 },
];

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const includeTiers = (() => {
    try {
      const param = req.nextUrl.searchParams.get('includeTiers');
      if (!param) return false;
      return param === '1' || param.toLowerCase() === 'true';
    } catch {
      return false;
    }
  })();

  const databaseConfigured = isDatabaseConfigured();
  if (!databaseConfigured) {
    const payload: Record<string, unknown> = { tier: 'Member', savingsPct: 0, spent30: 0, spentToday: 0, mock: true };
    if (includeTiers) {
      payload.tiers = FALLBACK_TIERS;
    }
    return NextResponse.json(payload);
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/member-status] schema init failed, returning defaults', error);
    const payload: Record<string, unknown> = { tier: 'Member', savingsPct: 0, spent30: 0, spentToday: 0, mock: true };
    if (includeTiers) {
      payload.tiers = FALLBACK_TIERS;
    }
    return NextResponse.json(payload);
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
    const payload: Record<string, unknown> = { tier: 'Member', savingsPct: 0, spent30: 0, spentToday: 0, mock: true };
    if (includeTiers) {
      payload.tiers = FALLBACK_TIERS;
    }
    return NextResponse.json(payload);
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

  const response: Record<string, unknown> = {
    tier: tierLabel,
    savingsPct,
    spent30: spent30 / 100,
    spentToday: spentToday / 100,
  };

  if (includeTiers) {
    response.tiers = tierConfigs.map((tier) => ({
      tier: tier.tier,
      spendThresholdCents: tier.spendThresholdCents,
      discountPercent: tier.discountPercent,
    }));
  }

  return NextResponse.json(response);
}
