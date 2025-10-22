import { NextRequest, NextResponse } from 'next/server';
import { issueManualWalletRefund, issueManualWalletRefundByReceipt } from '@/server/admin-transactions';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getUserIdentity } from '@/server/supabase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const receiptIdInput = payload?.receiptId;
  const parsedReceiptId =
    typeof receiptIdInput === 'number'
      ? receiptIdInput
      : typeof receiptIdInput === 'string'
        ? Number.parseInt(receiptIdInput, 10)
        : Number.NaN;
  const hasReceiptId = Number.isFinite(parsedReceiptId) && parsedReceiptId > 0;
  const note = typeof payload?.note === 'string' ? payload.note : undefined;

  if (!jobIdRaw && !hasReceiptId) {
    return NextResponse.json({ ok: false, error: 'Missing jobId or receiptId' }, { status: 400 });
  }

  let adminEmail: string | null = null;
  try {
    const identity = await getUserIdentity(adminUserId);
    adminEmail = identity?.email ?? null;
  } catch {
    adminEmail = null;
  }

  let lastError: unknown = null;

  if (jobIdRaw) {
    try {
      const refund = await issueManualWalletRefund({
        jobId: jobIdRaw,
        adminUserId,
        adminEmail,
        note,
      });
      return NextResponse.json({ ok: true, refund });
    } catch (error) {
      lastError = error;
      if (!hasReceiptId) {
        const message = error instanceof Error ? error.message : 'Manual refund failed';
        const status = /not found|already|wallet|Missing jobId/i.test(message) ? 400 : 500;
        console.error('[admin/transactions] manual refund failed', error);
        return NextResponse.json({ ok: false, error: message }, { status });
      }
    }
  }

  if (hasReceiptId) {
    try {
      const refund = await issueManualWalletRefundByReceipt({
        receiptId: parsedReceiptId,
        adminUserId,
        adminEmail,
        note,
      });
      return NextResponse.json({ ok: true, refund });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : 'Manual refund failed';
      const status = /not found|already|wallet|receipt|charge|Invalid receiptId/i.test(message) ? 400 : 500;
      console.error('[admin/transactions] manual refund failed', error);
      return NextResponse.json({ ok: false, error: message }, { status });
    }
  }

  const fallbackMessage = lastError instanceof Error ? lastError.message : 'Manual refund failed';
  console.error('[admin/transactions] manual refund failed', lastError);
  return NextResponse.json(
    { ok: false, error: fallbackMessage },
    { status: /not found|already|wallet|receipt|charge|Missing jobId/i.test(fallbackMessage) ? 400 : 500 }
  );
}
