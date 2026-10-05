import {retiredStudioCanvasWrite} from '../../../../_lib/studio-retired-canvas-handler';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { deleteStudioSequence, readStudioSequence } from '@/server/studio/repository';
import { connectedStudioError } from '../../../../_lib/studio-connected-route-utils';
import { resolveStudioRouteContext, studioJson } from '../../../../_lib/studio-route-utils';

type ProjectSequenceRouteProps = {
  params: Promise<{ projectId: string; sequenceId: string }>;
};

export async function GET(req: NextRequest, props: ProjectSequenceRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId, sequenceId } = await props.params;
  try {
    const sequence = await readStudioSequence({ userId: context.userId, projectId, sequenceId });
    if (!sequence) return studioJson({ ok: false, error: 'STUDIO_SEQUENCE_NOT_FOUND' }, { status: 404 });
    return studioJson({ ok: true, sequence });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'STUDIO_SEQUENCE_READ_FAILED';
    return studioJson({ ok: false, error: message }, { status: 500 });
  }
}
export async function PUT(req: NextRequest) {
  return retiredStudioCanvasWrite(req);
}

export async function PATCH(req: NextRequest) {
  return retiredStudioCanvasWrite(req);
}


export async function DELETE(req: NextRequest, props: ProjectSequenceRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId, sequenceId } = await props.params;
  try {
    const result = await deleteStudioSequence({ userId: context.userId, projectId, sequenceId });
    if (result.ok) return studioJson({ ok: true });
    if (result.reason === 'last_sequence') {
      return studioJson({ ok: false, error: 'STUDIO_SEQUENCE_LAST_SEQUENCE' }, { status: 409 });
    }
    return studioJson({ ok: false, error: 'STUDIO_SEQUENCE_NOT_FOUND' }, { status: 404 });
  } catch (error) {
    const failure = connectedStudioError(error, 'STUDIO_SEQUENCE_DELETE_FAILED');
    return studioJson({ ok: false, error: failure.error }, { status: failure.status });
  }
}