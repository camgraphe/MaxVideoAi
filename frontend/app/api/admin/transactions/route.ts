import { NextRequest, NextResponse } from 'next/server';
import { fetchTransactionHistory, fetchTransactionReceipt } from '@/server/admin-transactions/history';
import { parseTransactionHistoryParams,TransactionHistoryInputError } from '@/lib/admin/transaction-history';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  let filters;
  try {
    filters = parseTransactionHistoryParams(url.searchParams);
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 });
  }

  try {
    if (url.searchParams.has('receipt'))
      return NextResponse.json({ ok: true, receipt: await fetchTransactionReceipt(url.searchParams.get('receipt')!) });
    return NextResponse.json({ ok: true, ...(await fetchTransactionHistory(filters)) });
  } catch (error) {
    if(error instanceof TransactionHistoryInputError)return NextResponse.json({ok:false,error:error.message},{status:400});
    console.error('[admin/transactions] failed to load transactions', error);
    return NextResponse.json({ ok: false, error: 'Failed to load transactions', transactions: [] }, { status: 500 });
  }
}
