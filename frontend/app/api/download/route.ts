import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

function sanitizeFilename(value: string | null): string {
  const trimmed = value?.trim() || 'download';
  const cleaned = trimmed.replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'download';
}

function inferContentTypeFromFilename(fileName: string, fallback: string): string {
  const normalizedFallback = fallback.toLowerCase().split(';', 1)[0]?.trim();
  const genericTypes = new Set(['', 'application/octet-stream', 'binary/octet-stream', 'application/x-unknown']);
  if (normalizedFallback && !genericTypes.has(normalizedFallback)) return fallback;
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith('.mov')) return 'video/quicktime';
  if (lowered.endsWith('.webm')) return 'video/webm';
  if (lowered.endsWith('.mp4')) return 'video/mp4';
  if (lowered.endsWith('.mkv')) return 'video/x-matroska';
  if (lowered.endsWith('.avi')) return 'video/x-msvideo';
  if (lowered.endsWith('.gif')) return 'image/gif';
  return fallback || 'application/octet-stream';
}

export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const sourceUrl = (req.nextUrl.searchParams.get('url') ?? '').trim();
  const fileName = sanitizeFilename(req.nextUrl.searchParams.get('filename'));

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

  try {
    const upstream = await fetch(parsedUrl.toString(), { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ ok: false, error: 'FETCH_FAILED' }, { status: 502 });
    }

    const contentType = inferContentTypeFromFilename(fileName, upstream.headers.get('content-type') ?? 'application/octet-stream');
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[download] failed', error);
    return NextResponse.json({ ok: false, error: 'DOWNLOAD_FAILED' }, { status: 500 });
  }
}
