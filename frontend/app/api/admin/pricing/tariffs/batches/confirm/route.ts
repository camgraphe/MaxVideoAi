import type { NextRequest } from 'next/server';
import { tariffBatchHttp, batchCommand } from '@/server/pricing-admin/tariff-batches/http';
import { confirmTariffBatch } from '@/server/pricing-admin/tariff-batches/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  return tariffBatchHttp(req, true, async (actorId, payload) => {
    const { operationId, fingerprint } = batchCommand(payload, true);
    return { operation: await confirmTariffBatch(operationId, fingerprint, actorId) };
  });
}
