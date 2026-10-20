import { NextRequest } from 'next/server';
import { createCreatorOperationsService } from '@/server/tools/creator-operations';
import { readCreatorJson, runCreatorHttp } from '@/server/tools/creator-http';
export const runtime = 'nodejs';
export const maxDuration = 800;
export async function POST(request: NextRequest) {
  return runCreatorHttp(request, async actor => createCreatorOperationsService(actor, { enabled: true }).prepare(await readCreatorJson(request)), { execution: true });
}
