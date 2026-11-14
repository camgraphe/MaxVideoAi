import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { resolveAudioWebMedia } from '@/server/audio/audio-web-media-access';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
const failure = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers });

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return failure('UNAUTHORIZED', 401);
  const search = req.nextUrl.searchParams;
  const kind = search.get('kind');
  if ([...search.keys()].some(key => key !== 'kind') || search.getAll('kind').length !== 1
    || (kind !== 'audio' && kind !== 'video' && kind !== 'source')) return failure('INVALID_MEDIA_KIND', 400);
  try {
    const media = await resolveAudioWebMedia({ userId, jobId: params.jobId, kind });
    return media ? NextResponse.redirect(media.url, { status: 307, headers }) : failure('MEDIA_NOT_AVAILABLE', 404);
  } catch (error) {
    if (error instanceof Error && error.message === 'MEDIA_NOT_AVAILABLE') return failure('MEDIA_NOT_AVAILABLE', 404);
    return failure('MEDIA_READ_FAILED', 500);
  }
}
