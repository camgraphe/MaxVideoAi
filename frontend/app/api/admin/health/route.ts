import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { fetchAdminHealth } from '@/server/admin-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  try {
    const health = await fetchAdminHealth();
    return NextResponse.json({ ok: true, health });
  } catch (error) {
    console.error('[admin/health] failed to load snapshot', error);
    return NextResponse.json({ ok: false, error: 'Failed to load health snapshot' }, { status: 500 });
  }
}
