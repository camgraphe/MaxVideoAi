export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { deleteStudioProject, readStudioProject, upsertStudioProject } from '@/server/studio/repository';
import { payloadRecord, payloadString, resolveStudioRouteContext, studioJson } from '../../_lib/studio-route-utils';

type ProjectRouteProps = {
  params: Promise<{ projectId: string }>;
};

function readProjectPayload(payload: unknown): Record<string, unknown> {
  const body = payloadRecord(payload);
  return payloadRecord(body.project ?? body);
}

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

export async function PUT(req: NextRequest, props: ProjectRouteProps) {
  return saveStudioProject(req, props);
}

export async function PATCH(req: NextRequest, props: ProjectRouteProps) {
  return saveStudioProject(req, props);
}

async function saveStudioProject(req: NextRequest, props: ProjectRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId } = await props.params;
  const payload = await req.json().catch(() => null);
  const project = readProjectPayload(payload);

  try {
    const savedProject = await upsertStudioProject({
      userId: context.userId,
      id: projectId,
      name: payloadString(project.name) ?? 'Untitled edit',
      canvasTemplateId: payloadString(project.canvasTemplateId),
      settings: project.settings,
      workspaceState: project.workspaceState,
    });
    return studioJson({ ok: true, project: savedProject });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_PROJECT_SAVE_FAILED';
    const status = message === 'STUDIO_PROJECT_CONFLICT' ? 409 : 400;
    return studioJson({ ok: false, error: message }, { status });
  }
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
    const message = error instanceof Error ? error.message : 'STUDIO_PROJECT_DELETE_FAILED';
    return studioJson({ ok: false, error: message }, { status: 500 });
  }
}
