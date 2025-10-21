import { NextRequest, NextResponse } from 'next/server';
import { issueManualWalletRefund } from '@/server/admin-transactions';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getUserIdentity } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable' }, { status: 503 });
  }

  const payload = await req.json().catch(() => null);
  const jobIdRaw = typeof payload?.jobId === 'string' ? payload.jobId.trim() : '';
  const note = typeof payload?.note === 'string' ? payload.note : undefined;

  if (!jobIdRaw) {
    return NextResponse.json({ ok: false, error: 'Missing jobId' }, { status: 400 });
  }

  let adminEmail: string | null = null;
  try {
    const identity = await getUserIdentity(adminUserId);
    adminEmail = identity?.email ?? null;
  } catch {
    adminEmail = null;
  }

  try {
    const refund = await issueManualWalletRefund({
      jobId: jobIdRaw,
      adminUserId,
      adminEmail,
      note,
    });
    return NextResponse.json({ ok: true, refund });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Manual refund failed';
    const status = /not found|already|wallet|Missing jobId/i.test(message) ? 400 : 500;
    console.error('[admin/transactions] manual refund failed', error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
