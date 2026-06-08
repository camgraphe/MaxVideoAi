export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { listStudioProjects, upsertStudioProject } from '@/server/studio/repository';
import { payloadRecord, payloadString, resolveStudioRouteContext, studioJson } from '../_lib/studio-route-utils';

function readProjectPayload(payload: unknown): Record<string, unknown> {
  const body = payloadRecord(payload);
  return payloadRecord(body.project ?? body);
}

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
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const payload = await req.json().catch(() => null);
  const project = readProjectPayload(payload);

  try {
    const savedProject = await upsertStudioProject({
      userId: context.userId,
      id: payloadString(project.id),
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
