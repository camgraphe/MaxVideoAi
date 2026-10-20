import { withCreatorMediaReadAccess } from '@/server/tools/creator-media-access';
import { NextRequest } from 'next/server';
import { createCreatorOperationsService } from '@/server/tools/creator-operations';
import { readCreatorJson, runCreatorHttp } from '@/server/tools/creator-http';
export const runtime = 'nodejs';
export const maxDuration = 800;
export async function POST(request: NextRequest) {
  return runCreatorHttp(request, async actor => withCreatorMediaReadAccess(actor.userId, await createCreatorOperationsService(actor, { enabled: true }).confirm(await readCreatorJson(request))), { execution: true, charge: true });
}
