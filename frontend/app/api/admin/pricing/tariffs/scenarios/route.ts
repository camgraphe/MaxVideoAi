import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { PricingAdminError } from '@/server/pricing-admin/errors';
import { loadCustomerTariffScenarioDetail } from '@/server/pricing-admin/customer-tariff-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try { await requireAdmin(req); } catch (error) { return adminErrorToResponse(error); }
  const modelId = req.nextUrl.searchParams.get('modelId')?.trim() ?? '';
  if (!modelId || modelId.length > 100) {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }
  const requested: Record<string, string> = {};
  for (const [key, value] of req.nextUrl.searchParams) {
    if (key !== 'modelId' && key.length <= 40 && value.length <= 100) requested[key] = value;
  }
  try {
    return NextResponse.json({ ok: true, scenario: await loadCustomerTariffScenarioDetail(modelId, requested) },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof PricingAdminError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
