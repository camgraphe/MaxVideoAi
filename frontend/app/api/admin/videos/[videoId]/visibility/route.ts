import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';

type RouteParams = {
  params: {
    videoId: string;
  };
};

type VisibilityUpdateRow = {
  job_id: string;
  visibility: string | null;
  indexable: boolean | null;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const videoId = params.videoId;
  if (!videoId) {
    return NextResponse.json({ ok: false, error: 'Missing video id' }, { status: 400 });
  }

  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  let payload: { visibility?: string; indexable?: boolean } = {};
  try {
    payload = await req.json().catch(() => ({}));
  } catch {
    payload = {};
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  const nextVisibility = payload.visibility === 'public' || payload.visibility === 'private' ? payload.visibility : null;
  const nextIndexable = typeof payload.indexable === 'boolean' ? payload.indexable : null;

  if (nextVisibility) {
    updates.push(`visibility = $${updates.length + 1}`);
    values.push(nextVisibility);
    if (nextVisibility === 'private') {
      updates.push(`indexable = FALSE`);
    }
  }

  if (nextVisibility !== 'private' && typeof nextIndexable === 'boolean') {
    updates.push(`indexable = $${updates.length + 1}`);
    values.push(nextIndexable);
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
  }

  try {
    values.push(videoId);
    const rows = await query<VisibilityUpdateRow>(
      `
        UPDATE app_jobs
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE job_id = $${values.length}
        RETURNING job_id, visibility, indexable
      `,
      values
    );
    const updated = rows[0];
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'Video not found' }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      video: {
        id: updated.job_id,
        visibility: updated.visibility === 'private' ? 'private' : 'public',
        indexable: Boolean(updated.indexable ?? true),
      },
    });
  } catch (error) {
    console.error('[admin/videos/:id/visibility] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
