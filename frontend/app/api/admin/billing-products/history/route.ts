import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { loadBillingProductHistory } from '@/server/pricing-admin/billing-product-service';
import { PricingAdminError } from '@/server/pricing-admin/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  const rawLimit = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;
  const targetId = req.nextUrl.searchParams.get('targetId')?.trim() || undefined;
  try {
    return NextResponse.json({
      ok: true,
      events: await loadBillingProductHistory({ ...(limit ? { limit } : {}), ...(targetId ? { targetId } : {}) }),
    });
  } catch (error) {
    if (error instanceof PricingAdminError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
