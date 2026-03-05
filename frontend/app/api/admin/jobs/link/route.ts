import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { linkFalJob } from '@/server/admin-job-tools';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, error: 'DATABASE_URL is not configured on this environment.' },
      { status: 500 }
    );
  }

  try {
    const payload = await request.json().catch(() => ({}));
    const jobId = typeof payload?.jobId === 'string' ? payload.jobId.trim() : '';
    const providerJobId =
      typeof payload?.providerJobId === 'string' ? payload.providerJobId.trim() : null;

    if (!jobId) {
      return NextResponse.json({ ok: false, error: 'jobId is required.' }, { status: 400 });
    }

    const result = await linkFalJob({ jobId, providerJobId });
    return NextResponse.json({ ok: true, job: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to link job.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
