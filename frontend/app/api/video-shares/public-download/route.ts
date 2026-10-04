import { NextRequest, NextResponse } from 'next/server';
import { getPublicVideosByIds } from '@/server/videos';
import { publicExampleDownloadSource } from '@/server/video-shares';

export const runtime = 'nodejs';

/** A public example can be saved without granting access to arbitrary remote URLs. */
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')?.trim();
  if (!jobId || jobId.length > 256) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    const video = (await getPublicVideosByIds([jobId])).get(jobId);
    if (!video?.indexable || !video.videoUrl) return NextResponse.json({ ok: false }, { status: 404 });
    const source = publicExampleDownloadSource(video.videoUrl);
    if (!source) return NextResponse.json({ ok: false }, { status: 404 });

    const upstream = await fetch(source, { cache: 'no-store', redirect: 'manual', signal: req.signal });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ ok: false }, { status: 502 });
    const headers = new Headers({
      'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
      'Content-Disposition': 'attachment; filename="maxvideoai-video.mp4"',
      'Cache-Control': 'public, max-age=0, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    const length = upstream.headers.get('content-length');
    if (length && /^\d+$/.test(length)) headers.set('Content-Length', length);
    return new Response(upstream.body, { headers });
  } catch (error) {
    console.error('[video-shares] failed to download public example', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
