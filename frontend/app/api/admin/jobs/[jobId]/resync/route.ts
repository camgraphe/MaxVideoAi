import { NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { linkFalJob } from '@/server/admin-job-tools';
import { logAdminAction } from '@/server/admin-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { jobId: string } }) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const jobId = params.jobId?.trim();
  if (!jobId) {
    return NextResponse.json({ ok: false, error: 'Missing jobId' }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const providerJobId =
    payload && typeof payload.providerJobId === 'string' && payload.providerJobId.trim().length
      ? payload.providerJobId.trim()
      : undefined;

  try {
    const result = await linkFalJob({ jobId, providerJobId });
    await logAdminAction({
      adminId,
      targetUserId: result.userId,
      action: 'FORCE_RESYNC_JOB',
      route: `/api/admin/jobs/${jobId}/resync`,
      metadata: { jobId: result.jobId, engineId: result.engineId },
    });
    return NextResponse.json({ ok: true, job: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to resync job.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
