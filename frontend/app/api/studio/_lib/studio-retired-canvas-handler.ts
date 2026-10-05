import type {NextRequest} from 'next/server';
import {resolveStudioRouteContext,studioJson} from './studio-route-utils';

/** Fence stale private-editor tabs before they can recreate or revive retired data. */
export async function retiredStudioCanvasWrite(req: NextRequest,resolveContext = resolveStudioRouteContext) {
  const context = await resolveContext(req);
  if (context.response) return context.response;
  return studioJson({ok: false,error: 'STUDIO_CANVAS_RETIRED',studioUrl: '/app/studio'},{status: 410});
}
