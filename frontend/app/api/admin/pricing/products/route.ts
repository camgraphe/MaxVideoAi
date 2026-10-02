import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { loadAdminProductPricing } from '@/server/pricing-admin/product-pricing-inventory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 }); }
  const durationSec = Number(request.nextUrl.searchParams.get('durationSec') ?? 10);
  if (!Number.isInteger(durationSec) || durationSec < 3 || durationSec > 184) {
    return NextResponse.json({ ok: false, error: 'invalid_duration' }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, inventory: await loadAdminProductPricing(durationSec) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ ok: false, error: 'inventory_unavailable' }, { status: 503 }); }
}
