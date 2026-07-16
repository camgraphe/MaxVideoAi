import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';
import { getUserMembershipStatus } from '@/server/membership/user-membership-status';
import { getVisitorMemberStatus } from '@/server/visitor-workspace';

export const dynamic = 'force-dynamic';

function json(body: unknown, init?: Parameters<typeof NextResponse.json>[1]) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  const includeTiers = (() => {
    try {
      const param = req.nextUrl.searchParams.get('includeTiers');
      if (!param) return false;
      return param === '1' || param.toLowerCase() === 'true';
    } catch {
      return false;
    }
  })();

  if (!userId) {
    if (VISITOR_WORKSPACE_ENABLED) {
      return json(await getVisitorMemberStatus(includeTiers));
    }
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  let memberStatus: Awaited<ReturnType<typeof getUserMembershipStatus>>;
  try {
    memberStatus = await getUserMembershipStatus(userId);
  } catch (error) {
    console.warn('[api/member-status] query failed', error);
    return json({ error: 'Member status lookup failed' }, { status: 500 });
  }
  const tierLabel = `${memberStatus.pricing.tier.slice(0, 1).toUpperCase()}${memberStatus.pricing.tier.slice(1)}`;
  const savingsPct = Math.round(memberStatus.pricing.discountPercent * 100);

  const response: Record<string, unknown> = {
    tier: tierLabel,
    savingsPct,
    spent30: memberStatus.spent30Cents / 100,
    spentToday: memberStatus.spentTodayCents / 100,
  };

  if (includeTiers) {
    response.tiers = memberStatus.tiers.map((tier) => ({
      tier: tier.tier,
      spendThresholdCents: tier.spendThresholdCents,
      discountPercent: tier.discountPercent,
    }));
  }

  return json(response);
}
