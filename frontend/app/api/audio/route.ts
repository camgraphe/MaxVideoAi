import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    console.warn('[api/audio] DATABASE_URL not configured; skipping persistence for job', body.jobId);
    return NextResponse.json({ ok: true, persisted: false });
  }

  await ensureBillingSchema();
  try {
    const result = await query<{ job_id: string }>(
      `UPDATE app_jobs
       SET has_audio = TRUE
       WHERE job_id = $1
         AND user_id = $2
       RETURNING job_id`,
      [body.jobId, userId]
    );
    if (!result.length) {
      return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('[api/audio] failed to update job record', error);
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
