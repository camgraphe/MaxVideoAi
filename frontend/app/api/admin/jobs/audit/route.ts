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
  const cursor = url.searchParams.get('cursor');
  const jobId = sanitizeParam(url.searchParams.get('jobId'));
  const userId = sanitizeParam(url.searchParams.get('userId'));
  const engineId = sanitizeParam(url.searchParams.get('engineId'));
  const status = sanitizeParam(url.searchParams.get('status'));
  const from = parseDateParam(url.searchParams.get('from'));
  const to = parseDateParam(url.searchParams.get('to'));

  try {
    const { jobs, nextCursor } = await fetchRecentJobAudits({ limit, cursor, jobId, userId, engineId, status, from, to });
    return NextResponse.json({ ok: true, jobs, nextCursor });
  } catch (error) {
    console.error('[admin/jobs/audit] failed to load jobs', error);
    return NextResponse.json({ ok: false, error: 'Failed to load jobs', jobs: [] }, { status: 500 });
  }
}

function sanitizeParam(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}
