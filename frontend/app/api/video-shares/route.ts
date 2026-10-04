import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { isStablePublicMediaUrl } from '@/lib/media';
import { getPublicVideosByIds } from '@/server/videos';
import { createOrGetVideoShareLink, revokeVideoShareLink } from '@/server/video-shares';

export const runtime = 'nodejs';

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

function optionalId(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const url = typeof body?.url === 'string' && body.url.length <= 2048 ? body.url.trim() : '';
  const assetId = optionalId(body?.assetId);
  const sourceOutputId = optionalId(body?.sourceOutputId);
  const jobId = optionalId(body?.jobId);
  if (!url || (!assetId && !sourceOutputId && !jobId)) {
    return reply({ ok: false, error: 'INVALID_VIDEO' }, 400);
  }
  const origin = process.env.VERCEL_ENV === 'production' ? SITE_ORIGIN : req.nextUrl.origin;

  if (body?.source === 'public-example' && jobId) {
    try {
      const video = (await getPublicVideosByIds([jobId])).get(jobId);
      if (!video || video.videoUrl !== url || !video.indexable || !isStablePublicMediaUrl(url)) {
        return reply({ ok: false, error: 'VIDEO_NOT_SHAREABLE' }, 422);
      }
      return reply({ ok: true, token: null, url: new URL(`/video/${encodeURIComponent(jobId)}`, origin).toString() });
    } catch (error) {
      console.error('[video-shares] failed to resolve public example', error);
      return reply({ ok: false, error: 'SHARE_FAILED' }, 500);
    }
  }

  const { userId } = await getRouteAuthContext(req);
  if (!userId) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401);

  try {
    const token = await createOrGetVideoShareLink({ userId, url, assetId, sourceOutputId, jobId });
    if (!token) return reply({ ok: false, error: 'VIDEO_NOT_SHAREABLE' }, 422);
    return reply({ ok: true, token, url: new URL(`/s/${token}`, origin).toString() });
  } catch (error) {
    console.error('[video-shares] failed to create', error);
    return reply({ ok: false, error: 'SHARE_FAILED' }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return reply({ ok: false, error: 'UNAUTHORIZED' }, 401);
  const body = await req.json().catch(() => null);
  const token = optionalId(body?.token);
  if (!token) return reply({ ok: false, error: 'INVALID_TOKEN' }, 400);
  try {
    const revoked = await revokeVideoShareLink(token, userId);
    return revoked ? reply({ ok: true }) : reply({ ok: false, error: 'NOT_FOUND' }, 404);
  } catch (error) {
    console.error('[video-shares] failed to revoke', error);
    return reply({ ok: false, error: 'SHARE_FAILED' }, 500);
  }
}
