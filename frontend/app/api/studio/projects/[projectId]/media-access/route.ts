export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { renewStudioProjectMediaAccess } from '@/server/studio/media-access';
import { connectedStudioError } from '../../../_lib/studio-connected-route-utils';
import { payloadRecord, resolveStudioRouteContext, studioJson } from '../../../_lib/studio-route-utils';

type MediaAccessRouteProps = { params: Promise<{ projectId: string }> };

export async function POST(req: NextRequest, props: MediaAccessRouteProps) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const { projectId } = await props.params;
  const payload = payloadRecord(await req.json().catch(() => null));
  try {
    const result = await renewStudioProjectMediaAccess({ userId: context.userId }, {
      projectId,
      assetIds: payload.assetIds,
    });
    return studioJson({ ok: true, ...result });
  } catch (error) {
    const failure = connectedStudioError(error, 'STUDIO_MEDIA_ACCESS_FAILED');
    return studioJson({ ok: false, error: failure.error }, { status: failure.status });
  }
}
