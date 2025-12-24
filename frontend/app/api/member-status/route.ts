import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getMembershipTiers } from '@/lib/membership';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const dynamic = 'force-dynamic';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

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
    return json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    await ensureBillingSchema();
  } catch (error) {
    console.warn('[api/member-status] schema init failed', error);
    return json({ error: 'Database unavailable' }, { status: 503 });
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
    console.warn('[api/member-status] query failed', error);
    return json({ error: 'Member status lookup failed' }, { status: 500 });
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

  return json(response);
}
