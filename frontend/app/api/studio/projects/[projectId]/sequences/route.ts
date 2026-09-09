export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { listStudioSequences, upsertStudioSequence } from '@/server/studio/repository';
import { connectedStudioError } from '../../../_lib/studio-connected-route-utils';
import { payloadRecord, payloadString, resolveStudioRouteContext, studioJson } from '../../../_lib/studio-route-utils';

type ProjectSequencesRouteProps = {
  params: Promise<{ projectId: string }>;
};

function readSequencePayload(payload: unknown): Record<string, unknown> {
  const body = payloadRecord(payload);
  return payloadRecord(body.sequence ?? body);
}

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

export async function POST(req: NextRequest, props: ProjectSequencesRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId } = await props.params;
  const payload = await req.json().catch(() => null);
  const sequence = readSequencePayload(payload);

  try {
    const savedSequence = await upsertStudioSequence({
      userId: context.userId,
      projectId,
      id: payloadString(sequence.id),
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
