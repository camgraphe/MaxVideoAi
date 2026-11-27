import { NextRequest, NextResponse } from 'next/server';
import { parseTransactionHistoryParams, TransactionHistoryInputError } from '@/lib/admin/transaction-history';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { fetchTransactionHistory, fetchTransactionReceipt } from './history';

const headers = { 'Cache-Control': 'private, no-store' };
const services = { authorize: requireAdmin, receipt: fetchTransactionReceipt, history: fetchTransactionHistory };

export async function readAdminTransactions(req: NextRequest, deps = services) {
  try {
    await deps.authorize(req);
  } catch (error) {
    const response = adminErrorToResponse(error);
    response.headers.set('Cache-Control', headers['Cache-Control']);
    return response;
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, error: 'Database unavailable', transactions: [] }, { status: 503, headers });
  }
  const params = req.nextUrl.searchParams;
  let filters;
  try {
    filters = parseTransactionHistoryParams(params);
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400, headers });
  }
  try {
    if (params.has('receipt')) return NextResponse.json({ ok: true, receipt: await deps.receipt(params.get('receipt')!) }, { headers });
    return NextResponse.json({ ok: true, ...(await deps.history(filters)) }, { headers });
  } catch (error) {
    if (error instanceof TransactionHistoryInputError) return NextResponse.json({ ok: false, error: error.message }, { status: 400, headers });
    console.error('[admin/transactions] failed to load transactions', error);
    return NextResponse.json({ ok: false, error: 'Failed to load transactions', transactions: [] }, { status: 500, headers });
  }
}
