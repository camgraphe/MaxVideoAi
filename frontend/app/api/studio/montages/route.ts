export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { createStudioMontageProject } from '@/server/studio/montage-command';
import { isStudioMontageCreationEnabled } from '@/server/studio/feature-access';
import { connectedStudioError } from '../_lib/studio-connected-route-utils';
import { resolveStudioRouteContext, studioJson } from '../_lib/studio-route-utils';

export async function POST(req: NextRequest) {
  const context = await resolveStudioRouteContext(req);
  if (context.response) return context.response;

  const input = await req.json().catch(() => null);
  try {
    const montage = await createStudioMontageProject({ userId: context.userId }, input, {
      featureEnabled: isStudioMontageCreationEnabled(
        process.env,
        req.headers.get('host'),
        (FEATURES.mcp as Record<string, boolean>).studioMontageCreation === true,
      ),
    });
    return studioJson({ ok: true, montage });
  } catch (error) {
    const failure = connectedStudioError(error, 'STUDIO_MONTAGE_CREATE_FAILED');
    return studioJson({ ok: false, error: failure.error }, { status: failure.status });
  }
}
