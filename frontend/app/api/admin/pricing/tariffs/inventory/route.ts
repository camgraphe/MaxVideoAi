import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { loadCustomerTariffInventory } from '@/server/pricing-admin/customer-tariff-service';
import { PricingAdminError } from '@/server/pricing-admin/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try { await requireAdmin(req); } catch (error) { return adminErrorToResponse(error); }
  try {
    return NextResponse.json({ ok: true, inventory: await loadCustomerTariffInventory() },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof PricingAdminError) return NextResponse.json({ ok: false, error: error.code, message: error.message }, { status: error.status });
    return NextResponse.json({ ok: false, error: 'persistence_failed' }, { status: 500 });
  }
}
