import type { NextRequest } from 'next/server';
import { readAdminTransactions } from '@/server/admin-transactions/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: NextRequest) {
  return readAdminTransactions(req);
}
