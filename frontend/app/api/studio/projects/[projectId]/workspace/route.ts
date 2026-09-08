export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { readStudioWorkspace, saveStudioWorkspace } from '@/server/studio/workspace-command';
import { connectedStudioError } from '../../../_lib/studio-connected-route-utils';
import { payloadRecord, resolveStudioRouteContext, studioJson } from '../../../_lib/studio-route-utils';

type WorkspaceRouteProps = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, props: WorkspaceRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;
  const { projectId } = await props.params;
  try {
    const workspace = await readStudioWorkspace({ userId: context.userId }, projectId);
    return studioJson({ ok: true, ...workspace });
  } catch (error) {
    const failure = connectedStudioError(error, 'STUDIO_WORKSPACE_READ_FAILED');
    return studioJson({ ok: false, error: failure.error }, { status: failure.status });
  }
}

export async function PUT(req: NextRequest, props: WorkspaceRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId } = await props.params;
  const payload = payloadRecord(await req.json().catch(() => null));
  try {
    const saved = await saveStudioWorkspace({ userId: context.userId }, {
      projectId,
      expectedRevision: payload.expectedRevision as number,
      snapshot: payload.snapshot as never,
    });
    return studioJson({ ok: true, ...saved });
  } catch (error) {
    const failure = connectedStudioError(error, 'STUDIO_WORKSPACE_SAVE_FAILED');
    return studioJson({ ok: false, error: failure.error }, { status: failure.status });
  }
}
