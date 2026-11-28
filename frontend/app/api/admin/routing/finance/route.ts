import { type NextRequest } from 'next/server';
import { exportRoutingFinance } from '@/server/admin-routing-finance/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) {
  return exportRoutingFinance(req);
}
