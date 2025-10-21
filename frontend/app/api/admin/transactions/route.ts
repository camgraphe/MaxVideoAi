import { NextRequest, NextResponse } from 'next/server';
import { fetchAdminTransactions } from '@/server/admin-transactions';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
  } catch (error) {
    return adminErrorToResponse(error);
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable', transactions: [] }, { status: 503 });
  }

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get('limit') ?? '100');
  const limit = Number.isFinite(limitParam) ? limitParam : 100;

  try {
    const transactions = await fetchAdminTransactions(limit);
    return NextResponse.json({ ok: true, transactions });
  } catch (error) {
    console.error('[admin/transactions] failed to load transactions', error);
    return NextResponse.json({ ok: false, error: 'Failed to load transactions', transactions: [] }, { status: 500 });
  }
}
