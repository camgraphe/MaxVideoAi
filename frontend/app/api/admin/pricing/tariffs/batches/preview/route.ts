import type { NextRequest } from 'next/server';
import { tariffBatchHttp } from '@/server/pricing-admin/tariff-batches/http';
import { previewTariffBatch } from '@/server/pricing-admin/tariff-batches/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
  return tariffBatchHttp(req, true, async (actorId, payload) => ({ operation: await previewTariffBatch(payload, actorId) }));
}
