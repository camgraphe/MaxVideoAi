import {retiredStudioCanvasWrite} from '../../../_lib/studio-retired-canvas-handler';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { listStudioSequences } from '@/server/studio/repository';
import { resolveStudioRouteContext, studioJson } from '../../../_lib/studio-route-utils';

type ProjectSequencesRouteProps = {
  params: Promise<{ projectId: string }>;
};

export async function GET(req: NextRequest, props: ProjectSequencesRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId } = await props.params;
  try {
    const sequences = await listStudioSequences({ userId: context.userId, projectId });
    return studioJson({ ok: true, sequences });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_SEQUENCES_LIST_FAILED';
    return studioJson({ ok: false, error: message }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  return retiredStudioCanvasWrite(req);
}
