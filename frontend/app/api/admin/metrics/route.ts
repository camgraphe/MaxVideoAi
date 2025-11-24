import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { fetchAdminMetrics } from '@/server/admin-metrics';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const metrics = await fetchAdminMetrics(req.nextUrl.searchParams.get('range'));
    return NextResponse.json({ ok: true, ...metrics });
  } catch (error) {
    return adminErrorToResponse(error);
  }
}
