import type { NextRequest } from 'next/server';
import { tariffBatchHttp, batchCommand } from '@/server/pricing-admin/tariff-batches/http';
import { readTariffBatch } from '@/server/pricing-admin/tariff-batches/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  return tariffBatchHttp(req, false, async actorId => ({ operation: await readTariffBatch(
    batchCommand({ operationId: new URL(req.url).searchParams.get('operationId') }).operationId, actorId) }));
}
