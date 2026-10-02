import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { previewCustomerTariffChange } from '@/server/pricing-admin/customer-tariff-service';
import type { CustomerTariffChangeProposal } from '@/server/pricing-admin/customer-tariff-contract';
import { PricingAdminError } from '@/server/pricing-admin/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try { await requireAdmin(req); } catch (error) { return adminErrorToResponse(error); }
  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, preview: await previewCustomerTariffChange(payload as CustomerTariffChangeProposal) },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof PricingAdminError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
