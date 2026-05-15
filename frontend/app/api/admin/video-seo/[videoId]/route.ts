import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getSeoVideoById } from '@/server/videos';
import {
  listVideoSeoEditorialEntries,
  upsertVideoSeoEditorialEntry,
  validateVideoSeoEditorialUpdatePayload,
} from '@/server/video-seo-editorial';

export const runtime = 'nodejs';

type RouteParams = {
  params: Promise<{
    videoId: string;
  }>;
};

export async function PUT(req: NextRequest, props: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const params = await props.params;
  const videoId = params.videoId?.trim();
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const video = await getSeoVideoById(videoId);
    const entries = await listVideoSeoEditorialEntries();
    const fallback = entries.find((entry) => entry.id === videoId) ?? null;
    const validation = validateVideoSeoEditorialUpdatePayload({
      videoId,
      payload,
      fallback,
      otherEntries: entries,
      qaContext: {
        promptText: video?.prompt,
        hasVideoAsset: Boolean(video?.videoUrl),
        hasThumbnailAsset: Boolean(video?.thumbUrl),
        technicallyIndexable: Boolean(video?.videoUrl && video?.thumbUrl && video?.visibility === 'public' && video?.indexable),
      },
    });
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error, qa: validation.qa }, { status: 400 });
    }

    const editorial = await upsertVideoSeoEditorialEntry(
      validation.entry,
      adminUserId,
      typeof payload.notes === 'string' ? payload.notes : null
    );

    return NextResponse.json({ ok: true, editorial, qa: validation.qa });
  } catch (error) {
    console.error('[api/admin/video-seo/:videoId] failed to save page', error);
    const message = error instanceof Error ? error.message : 'Failed to save video SEO page';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
