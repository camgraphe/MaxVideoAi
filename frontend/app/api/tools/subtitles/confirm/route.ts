import { withCreatorMediaReadAccess } from '@/server/tools/creator-media-access';
import { NextRequest } from 'next/server';
import { createSubtitleOperationsService } from '@/server/subtitles/operations';
import { readCreatorJson, runCreatorHttp } from '@/server/tools/creator-http';
export const runtime = 'nodejs';
export const maxDuration = 800;
export async function POST(request: NextRequest) {
  return runCreatorHttp(request, async actor => withCreatorMediaReadAccess(actor.userId, await createSubtitleOperationsService(actor, { enabled: true }).confirm(await readCreatorJson(request))), { execution: true, charge: true });
}
