import { NextRequest, NextResponse } from 'next/server';
import { isDatabaseConfigured, query } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.jobId) return NextResponse.json({ ok: false, error: 'jobId required' }, { status: 400 });
  if (!isDatabaseConfigured()) {
    console.warn('[api/audio] DATABASE_URL not configured; skipping persistence for job', body.jobId);
    return NextResponse.json({ ok: true, persisted: false });
  }

  await ensureBillingSchema();
  try {
    await query(`UPDATE app_jobs SET has_audio = TRUE WHERE job_id = $1`, [body.jobId]);
  } catch (error) {
    console.error('[api/audio] failed to update job record', error);
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, persisted: true });
}
