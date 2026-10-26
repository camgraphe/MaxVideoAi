import type { NextRequest } from 'next/server';
import { tariffBatchHttp } from '@/server/pricing-admin/tariff-batches/http';
import { tariffBatchOptions, listTariffBatches } from '@/server/pricing-admin/tariff-batches/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  return tariffBatchHttp(req, false, async actorId => {
    const options = await tariffBatchOptions().catch(() => ({ enabled: false as const, classes: [],
      unavailableMessage: 'Batch creation is unavailable for this deployment. Saved operations can still be checked.' }));
    return { actorId, ...options, operations: options.enabled ? await listTariffBatches(actorId) : [] };
  });
}
