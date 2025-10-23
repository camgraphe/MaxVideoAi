import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const payload = await req.json().catch(() => null);
  const jobId = typeof payload?.jobId === 'string' ? payload.jobId.trim() : '';

  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'Missing jobId' }, { status: 400 });
  }

  try {
    await query(
      `UPDATE app_jobs
         SET updated_at = NOW(),
             hidden = FALSE
       WHERE job_id = $1`,
      [jobId]
    );

    await query(
      `INSERT INTO fal_queue_log (job_id, provider, provider_job_id, engine_id, status, payload)
       SELECT job_id, 'admin', provider_job_id, engine_id, 'admin:reactivated', jsonb_build_object('at', NOW())
       FROM app_jobs
       WHERE job_id = $1
       ON CONFLICT DO NOTHING`,
      [jobId]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin/jobs/restore] failed to restore job', jobId, error);
    return NextResponse.json({ ok: false, error: 'Failed to restore job' }, { status: 500 });
  }
}
