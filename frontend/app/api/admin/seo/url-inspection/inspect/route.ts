import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return withNoIndex(adminErrorToResponse(error));
  }
  return withNoIndex(NextResponse.json(
    { ok: false, error: 'The in-app Search Console tool has been retired.', href: '/admin/seo' },
    { status: 410 }
  ));
}

function withNoIndex(response: NextResponse) {
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
