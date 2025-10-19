import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/server/admin';
import { fetchAdminPricingOverview } from '@/server/pricing-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (response) {
    if (response instanceof Response) return response;
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const refresh = req.nextUrl.searchParams.get('refresh');
  const overview = await fetchAdminPricingOverview({
    refreshCatalog: refresh === '1' || refresh === 'true',
  });
  return NextResponse.json(overview);
}
