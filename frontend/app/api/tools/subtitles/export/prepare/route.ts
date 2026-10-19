import { NextRequest } from 'next/server';
import { createSubtitleOperationsService } from '@/server/subtitles/operations';
import { readCreatorJson, runCreatorHttp } from '@/server/tools/creator-http';
export const runtime = 'nodejs';
export const maxDuration = 800;
export async function POST(request: NextRequest) {
  return runCreatorHttp(request, async actor => createSubtitleOperationsService(actor, { enabled: true }).prepareExport(await readCreatorJson(request)), { execution: true });
}
