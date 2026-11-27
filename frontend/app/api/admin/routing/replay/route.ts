import { NextResponse, type NextRequest } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { readHistoricalReplay, replayFilters } from '@/app/(core)/admin/routing/_lib/historical-replay-data';

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
  const filters = replayFilters(request.nextUrl.searchParams);
  if (!filters) return NextResponse.json({ error: 'invalid_replay_filters' }, { status: 400, headers });
  try {
    return NextResponse.json(await readHistoricalReplay(filters), { headers });
  } catch {
    return NextResponse.json({ error: 'historical_routing_unavailable' }, { status: 503, headers });
  }
}
