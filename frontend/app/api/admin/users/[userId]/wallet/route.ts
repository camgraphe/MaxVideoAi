import { NextRequest, NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { getWalletBalanceCents } from '@/lib/wallet';
import { query } from '@/lib/db';
import { issueManualWalletTopUp } from '@/server/admin-transactions';
import { getUserIdentity } from '@/server/supabase-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  const userId = params.userId;
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const { balanceCents, mock } = await getWalletBalanceCents(userId);

  let stats = null;
  if (process.env.DATABASE_URL) {
    const aggregates = await query<{ type: string; total: number }>(
      `SELECT type, COALESCE(SUM(amount_cents), 0) AS total
       FROM app_receipts
       WHERE user_id = $1
       GROUP BY type`,
      [userId]
    );
    stats = aggregates.reduce<Record<string, number>>((acc, row) => {
      acc[row.type] = Number(row.total ?? 0);
      return acc;
    }, {});
  }

  return NextResponse.json({
    ok: true,
    balanceCents,
    balance: balanceCents / 100,
    currency: 'USD',
    mock,
    stats,
  });
}

export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  let adminUserId: string;
  try {
    adminUserId = await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 501 });
  }

  const targetUserId = params.userId?.trim();
  if (!targetUserId) {
    return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const amountInput = typeof payload.amountCents === 'number' ? payload.amountCents : Number(payload.amountCents);
  const amountCents = Math.round(Number.isFinite(amountInput) ? amountInput : Number.NaN);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid amount' }, { status: 400 });
  }

  const currency =
    typeof payload.currency === 'string' && payload.currency.trim().length ? payload.currency.trim() : 'USD';
  const note = typeof payload.note === 'string' && payload.note.trim().length ? payload.note.trim() : null;
  const description = note ? `Manual credit — ${note}` : null;

  let adminEmail: string | null = null;
  try {
    const identity = await getUserIdentity(adminUserId);
    adminEmail = identity?.email ?? null;
  } catch {
    adminEmail = null;
  }

  try {
    const topup = await issueManualWalletTopUp({
      userId: targetUserId,
      amountCents,
      currency,
      description,
      adminUserId,
      adminEmail,
      note,
    });

    const { balanceCents } = await getWalletBalanceCents(targetUserId);

    return NextResponse.json({
      ok: true,
      receiptId: topup.receiptId,
      createdAt: topup.createdAt,
      amountCents: topup.amountCents,
      currency: topup.currency,
      balanceCents,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Manual credit failed';
    const isClientError = /Missing|amount|Invalid|user|wallet|Database/i.test(message);
    console.error('[admin/users] manual wallet credit failed', error);
    return NextResponse.json({ ok: false, error: message }, { status: isClientError ? 400 : 500 });
  }
}
