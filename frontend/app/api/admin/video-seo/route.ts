import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getSeoVideoById } from '@/server/videos';
import {
  buildDraftVideoSeoEditorialEntry,
  upsertVideoSeoEditorialEntry,
} from '@/server/video-seo-editorial';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const payload = await req.json().catch(() => null);
  const videoId = typeof payload?.videoId === 'string' ? payload.videoId.trim() : '';
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  try {
    const video = await getSeoVideoById(videoId);
    if (!video) {
      return NextResponse.json({ ok: false, error: 'Public indexable video not found' }, { status: 404 });
    }

    const editorial = await upsertVideoSeoEditorialEntry(
      buildDraftVideoSeoEditorialEntry(video),
      adminUserId,
      'Created from admin video SEO cockpit'
    );
    return NextResponse.json({ ok: true, editorial });
  } catch (error) {
    console.error('[api/admin/video-seo] failed to create candidate', error);
    const message = error instanceof Error ? error.message : 'Failed to create video SEO candidate';
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
