import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { getUserIdFromRequest } from '@/lib/user';
import { query } from '@/lib/db';
import { isCommercialAccountAnalyticsEligible } from '@/server/wallet-first-topup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    return NextResponse.json({ ok: true, commercialAnalyticsEligible: false });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      const userId = await getUserIdFromRequest(req).catch(() => null);
      const eligible = userId ? await isCommercialAccountAnalyticsEligible({ query }, userId) : false;
      return NextResponse.json({ ok: false, commercialAnalyticsEligible: eligible });
    }
    console.error('[admin/access] failed to check admin access', error);
    return NextResponse.json({ ok: false, error: 'Failed to check access' }, { status: 500 });
  }
}
