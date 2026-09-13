import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { readRecentOutputMetadata } from '@/server/media-library/recent-output-metadata';

export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!userId) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401, headers });
  const id = req.nextUrl.searchParams.get('outputId');
  if (!id || id.length > 256 || id.trim() !== id) {
    return NextResponse.json({ ok: false, error: 'INVALID_OUTPUT' }, { status: 400, headers });
  }
  try {
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(8_000)]);
    const asset = await readRecentOutputMetadata(id, userId, signal);
    if (!asset) return NextResponse.json({ ok: false, error: 'METADATA_UNAVAILABLE' }, { status: 404, headers });
    return NextResponse.json({ ok: true, asset }, { headers });
  } catch {
    return NextResponse.json({ ok: false, error: 'METADATA_UNAVAILABLE' }, { status: 503, headers });
  }
}
