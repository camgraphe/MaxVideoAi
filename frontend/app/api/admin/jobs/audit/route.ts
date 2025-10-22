import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminErrorToResponse } from '@/server/admin';
import { fetchRecentJobAudits } from '@/server/admin-job-audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable', jobs: [] }, { status: 503 });
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '30');
  const limit = Number.isFinite(limitParam) ? limitParam : 30;

  try {
    const jobs = await fetchRecentJobAudits(limit);
    return NextResponse.json({ ok: true, jobs });
  } catch (error) {
    console.error('[admin/jobs/audit] failed to load jobs', error);
    return NextResponse.json({ ok: false, error: 'Failed to load jobs', jobs: [] }, { status: 500 });
  }
}
