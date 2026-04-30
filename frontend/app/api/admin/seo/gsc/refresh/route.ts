import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { fetchGscDashboardData } from '@/server/seo/gsc';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return withNoIndex(adminErrorToResponse(error));
  }

  try {
    const data = await fetchGscDashboardData({
      range: req.nextUrl.searchParams.get('range'),
      forceRefresh: true,
    });
    if (!data.configured) {
      return withNoIndex(NextResponse.json({ ok: false, error: data.error }, { status: 503 }));
    }
    if (!data.ok) {
      return withNoIndex(NextResponse.json({ ok: false, error: data.error ?? 'GSC refresh failed' }, { status: 502 }));
    }
    return withNoIndex(NextResponse.json({ ok: true, fetchedAt: data.fetchedAt }));
  } catch (error) {
    console.error('[admin/seo/gsc] refresh failed', error);
    return withNoIndex(NextResponse.json({ ok: false, error: 'Failed to refresh GSC data' }, { status: 500 }));
  }
}

function withNoIndex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
