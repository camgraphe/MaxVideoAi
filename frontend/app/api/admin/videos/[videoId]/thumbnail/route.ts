import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { normalizeMediaUrl } from '@/lib/media';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';
import { ensureJobThumbnail } from '@/server/thumbnails';

type RouteParams = {
  params: {
    videoId: string;
  };
};

type ThumbnailRow = {
  job_id: string;
  user_id: string | null;
  video_url: string | null;
  aspect_ratio: string | null;
  thumb_url: string | null;
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const videoId = typeof params.videoId === 'string' ? params.videoId.trim() : '';
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  let payload: { seekSec?: number } = {};
  try {
    payload = await req.json().catch(() => ({}));
  } catch {
    payload = {};
  }

  const seekSec = typeof payload.seekSec === 'number' && Number.isFinite(payload.seekSec) ? Math.max(0, payload.seekSec) : 0;

  try {
    await ensureBillingSchema();
    const rows = await query<ThumbnailRow>(
      `SELECT job_id, user_id, video_url, aspect_ratio, thumb_url
         FROM app_jobs
        WHERE job_id = $1
        LIMIT 1`,
      [videoId]
    );

    const job = rows[0];
    if (!job) {
      return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 });
    }
    if (!job.video_url) {
      return NextResponse.json({ ok: false, error: 'Video has no media URL' }, { status: 400 });
    }

    const nextThumbUrl = await ensureJobThumbnail({
      jobId: job.job_id,
      userId: job.user_id ?? undefined,
      videoUrl: job.video_url,
      aspectRatio: job.aspect_ratio ?? undefined,
      existingThumbUrl: job.thumb_url ?? undefined,
      force: true,
      seekSec,
    });

    if (!nextThumbUrl) {
      return NextResponse.json({ ok: false, error: 'Thumbnail capture failed' }, { status: 500 });
    }

    const normalizedThumbUrl = normalizeMediaUrl(nextThumbUrl) ?? nextThumbUrl;

    await query(
      `UPDATE app_jobs
          SET thumb_url = $2,
              preview_frame = $2,
              updated_at = NOW()
        WHERE job_id = $1`,
      [videoId, normalizedThumbUrl]
    );

    return NextResponse.json({
      ok: true,
      thumbUrl: normalizedThumbUrl,
      seekSec,
    });
  } catch (error) {
    console.error('[admin/videos/:id/thumbnail] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
