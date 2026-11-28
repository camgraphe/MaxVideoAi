import { NextResponse, type NextRequest } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { readRoutingTraffic } from '@/app/(core)/admin/routing/_lib/routing-traffic';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (error) {
    const response = adminErrorToResponse(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
  const snapshot = await readRoutingTraffic().catch(() => null);
  if (!snapshot) return NextResponse.json({ error: 'routing_traffic_unavailable' }, { status: 503, headers });
  return NextResponse.json(snapshot, { headers });
}
