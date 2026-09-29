import { NextRequest, NextResponse } from 'next/server';
import type { VideoSeoStatus } from '@/config/video-seo-editorial';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';

type RouteParams = { params: Promise<{ videoId: string }> };
type StatusRow = { editorial: { seoStatus: VideoSeoStatus } | null; isEligible: boolean };
type Deps = {
  authorize: (req: NextRequest) => Promise<string>;
  getRow: (videoId: string) => Promise<StatusRow | null>;
};
const noStore = { 'Cache-Control': 'private, no-store' };

export async function handleVideoSeoStatusGet(req: NextRequest, props: RouteParams, deps: Deps = {
  authorize: requireAdmin, getRow: async videoId => (await import('@/server/video-seo')).getSeoWatchVideoRowById(videoId),
}) {
  try { await deps.authorize(req); }
  catch (error) { return adminErrorToResponse(error); }

  const { videoId: rawId } = await props.params;
  const videoId = rawId?.trim();
  if (!videoId) return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400, headers: noStore });

  try {
    const row = await deps.getRow(videoId);
    return NextResponse.json({
      ok: true,
      status: row ? row.editorial?.seoStatus ?? 'candidate' : 'not_selected',
      inVideoSitemap: Boolean(row?.isEligible),
    }, { headers: noStore });
  } catch (error) {
    console.error('[api/admin/video-seo/status] read failed', error);
    return NextResponse.json({ ok: false, error: 'Video SEO status unavailable' }, { status: 503, headers: noStore });
  }
}
