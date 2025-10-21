import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getUserIdFromRequest } from '@/lib/user';
import { getVideoById, updateVideoIndexableForUser } from '@/server/videos';

type RouteParams = {
  params: {
    videoId: string;
  };
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const { videoId } = params;
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  try {
    await ensureBillingSchema();
    const video = await getVideoById(videoId);
    if (!video) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, video });
  } catch (error) {
    console.error('[api/videos/:id] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const { videoId } = params;
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const { indexable } = body as { indexable?: unknown };
  if (typeof indexable !== 'boolean') {
    return NextResponse.json({ ok: false, error: 'Invalid indexing flag' }, { status: 400 });
  }

  try {
    await ensureBillingSchema();
    const updated = await updateVideoIndexableForUser(videoId, userId, indexable);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }
    const video = await getVideoById(videoId);
    return NextResponse.json({ ok: true, indexable, video });
  } catch (error) {
    console.error('[api/videos/:id] failed to update indexing', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
