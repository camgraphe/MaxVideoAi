import {retiredStudioCanvasWrite} from '../_lib/studio-retired-canvas-handler';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { listStudioProjects } from '@/server/studio/repository';
import { resolveStudioRouteContext, studioJson } from '../_lib/studio-route-utils';

export async function GET(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  try {
    const projects = await listStudioProjects({ userId: context.userId });
    return studioJson({ ok: true, projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_PROJECTS_LIST_FAILED';
    return studioJson({ ok: false, error: message }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  return retiredStudioCanvasWrite(req);
}
