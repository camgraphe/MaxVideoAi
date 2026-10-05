import {retiredStudioCanvasWrite} from '../../_lib/studio-retired-canvas-handler';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { deleteStudioProject, readStudioProject } from '@/server/studio/repository';
import { connectedStudioError } from '../../_lib/studio-connected-route-utils';
import { resolveStudioRouteContext, studioJson } from '../../_lib/studio-route-utils';

type ProjectRouteProps = {
  params: Promise<{ projectId: string }>;
};

export async function GET(req: NextRequest, props: ProjectRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId } = await props.params;
  try {
    const project = await readStudioProject({ userId: context.userId, projectId });
    if (!project) return studioJson({ ok: false, error: 'STUDIO_PROJECT_NOT_FOUND' }, { status: 404 });
    return studioJson({ ok: true, project });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_PROJECT_READ_FAILED';
    return studioJson({ ok: false, error: message }, { status: 500 });
  }
}
export async function PUT(req: NextRequest) {
  return retiredStudioCanvasWrite(req);
}

export async function PATCH(req: NextRequest) {
  return retiredStudioCanvasWrite(req);
}


export async function DELETE(req: NextRequest, props: ProjectRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId } = await props.params;
  try {
    const deleted = await deleteStudioProject({ userId: context.userId, projectId });
    if (!deleted) return studioJson({ ok: false, error: 'STUDIO_PROJECT_NOT_FOUND' }, { status: 404 });
    return studioJson({ ok: true });
  } catch (error) {
    const failure = connectedStudioError(error, 'STUDIO_PROJECT_DELETE_FAILED');
    return studioJson({ ok: false, error: failure.error }, { status: failure.status });
  }
}