export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { deleteStudioSequence, readStudioSequence, upsertStudioSequence } from '@/server/studio/repository';
import { connectedStudioError } from '../../../../_lib/studio-connected-route-utils';
import { payloadRecord, payloadString, resolveStudioRouteContext, studioJson } from '../../../../_lib/studio-route-utils';

type ProjectSequenceRouteProps = {
  params: Promise<{ projectId: string; sequenceId: string }>;
};

function readSequencePayload(payload: unknown): Record<string, unknown> {
  const body = payloadRecord(payload);
  return payloadRecord(body.sequence ?? body);
}

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

export async function PUT(req: NextRequest, props: ProjectSequenceRouteProps) {
  return saveStudioSequence(req, props);
}

export async function PATCH(req: NextRequest, props: ProjectSequenceRouteProps) {
  return saveStudioSequence(req, props);
}

async function saveStudioSequence(req: NextRequest, props: ProjectSequenceRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId, sequenceId } = await props.params;
  const payload = await req.json().catch(() => null);
  const sequence = readSequencePayload(payload);

  try {
    const savedSequence = await upsertStudioSequence({
      userId: context.userId,
      projectId,
      id: sequenceId,
      name: payloadString(sequence.name) ?? 'Untitled sequence',
      settings: sequence.settings,
      timelineState: sequence.timelineState,
    });
    return studioJson({ ok: true, sequence: savedSequence });
  } catch (error) {
    const failure = connectedStudioError(error, 'STUDIO_SEQUENCE_SAVE_FAILED');
    const status = failure.error === 'STUDIO_SEQUENCE_CONFLICT' ? 409 : failure.status;
    return studioJson({ ok: false, error: failure.error }, { status });
  }
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
