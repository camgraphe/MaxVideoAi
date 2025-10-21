import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';

type RouteParams = {
  params: {
    videoId: string;
  };
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

  if (payload.visibility === 'public' || payload.visibility === 'private') {
    updates.push(`visibility = $${updates.length + 1}`);
    values.push(payload.visibility);
    if (payload.visibility === 'private') {
      updates.push(`indexable = FALSE`);
    }
  }

  if (typeof payload.indexable === 'boolean') {
    updates.push(`indexable = $${updates.length + 1}`);
    values.push(payload.indexable);
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: false, error: 'No updates provided' }, { status: 400 });
  }

  try {
    await ensureBillingSchema();
    values.push(videoId);
    await query(
      `
        UPDATE app_jobs
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE job_id = $${values.length}
      `,
      values
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/videos/:id/visibility] failed', error);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
