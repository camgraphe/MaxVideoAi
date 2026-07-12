import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { PricingAdminError } from '@/server/pricing-admin/errors';
import { loadPricingPolicyHistory } from '@/server/pricing-admin/policy-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }
  const targetId = req.nextUrl.searchParams.get('targetId')?.trim() || undefined;
  const rawLimit = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) ? rawLimit : undefined;
  try {
    const events = await loadPricingPolicyHistory({ ...(targetId ? { targetId } : {}), ...(limit ? { limit } : {}) });
    return NextResponse.json({ ok: true, events });
  } catch (error) {
    if (error instanceof PricingAdminError) {
      return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
