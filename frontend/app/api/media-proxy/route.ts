import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { VISITOR_WORKSPACE_ENABLED } from '@/lib/visitor-access';

export const runtime = 'nodejs';

const PUBLIC_MEDIA_PROXY_HOSTS = new Set([
  'videohub-uploads-us.s3.amazonaws.com',
  'v3b.fal.media',
  'fal.media',
]);

export async function GET(req: NextRequest) {
  const sourceUrl = (req.nextUrl.searchParams.get('url') ?? '').trim();
  if (!sourceUrl) {
    return NextResponse.json({ ok: false, error: 'URL_REQUIRED' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    return NextResponse.json({ ok: false, error: 'INVALID_URL' }, { status: 400 });
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return NextResponse.json({ ok: false, error: 'INVALID_URL' }, { status: 400 });
  }

  const { userId } = await getRouteAuthContext(req);
  const isPublicHost = PUBLIC_MEDIA_PROXY_HOSTS.has(parsedUrl.hostname.toLowerCase());
  if (!userId) {
    if (!VISITOR_WORKSPACE_ENABLED || !isPublicHost) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }
  }

  try {
    const upstream = await fetch(parsedUrl.toString(), { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ ok: false, error: 'FETCH_FAILED' }, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream';
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[media-proxy] failed', error);
    return NextResponse.json({ ok: false, error: 'PROXY_FAILED' }, { status: 500 });
  }
}
