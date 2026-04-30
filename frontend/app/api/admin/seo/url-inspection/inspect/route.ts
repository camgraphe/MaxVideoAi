import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { inspectCuratedUrls } from '@/server/seo/url-inspection';
import type { UrlInspectionGroup } from '@/lib/seo/internal-seo-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return withNoIndex(adminErrorToResponse(error));
  }

  try {
    const payload = (await req.json().catch(() => ({}))) as {
      urls?: string[];
      group?: UrlInspectionGroup | 'all';
      force?: boolean;
    };
    const result = await inspectCuratedUrls({
      range: req.nextUrl.searchParams.get('range'),
      urls: payload.urls,
      group: payload.group,
      force: payload.force,
    });

    return withNoIndex(NextResponse.json({
      ok: true,
      inspected: result.inspected.length,
      skipped: result.skipped.length,
    }));
  } catch (error) {
    console.error('[admin/seo/url-inspection] inspection failed', error);
    const message = error instanceof Error ? error.message : 'Failed to inspect curated URLs.';
    return withNoIndex(NextResponse.json({ ok: false, error: message }, { status: 500 }));
  }
}

function withNoIndex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
