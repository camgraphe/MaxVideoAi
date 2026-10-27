import type { NextRequest } from 'next/server';
import { tariffBatchHttp, batchCommand } from '@/server/pricing-admin/tariff-batches/http';
import { refreshTariffBatchPages } from '@/server/pricing-admin/tariff-batches/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  return tariffBatchHttp(req, true, async (actorId, payload) => ({ operation: await refreshTariffBatchPages(batchCommand(payload).operationId, actorId) }));
}
