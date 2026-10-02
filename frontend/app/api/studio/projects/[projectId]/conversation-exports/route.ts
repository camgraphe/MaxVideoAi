import type {NextRequest} from 'next/server';
import {resolveStudioRouteContext,studioJson} from '../../../_lib/studio-route-utils';
import {studioConversationEditingEnabled} from '../../../_lib/studio-conversation-editing-handler';
import {listStudioProjectTimelineExports} from '@/server/timeline-exports/repository';
export const runtime = 'nodejs';
export async function GET(req: NextRequest,context: {params: Promise<{projectId: string}>}) {
  const access = await resolveStudioRouteContext(req);
  if (access.response) return access.response;
  if (!studioConversationEditingEnabled() || process.env.STUDIO_CONVERSATION_EXPORTS_ENABLED !== 'true') return studioJson({ok: false,error: 'STUDIO_EXPORTS_UNAVAILABLE'},{status: 404});
  const {projectId} = await context.params;
  try {return studioJson({ok: true,exports: await listStudioProjectTimelineExports({userId: access.userId,projectId})});}
  catch {return studioJson({ok: false,error: 'STUDIO_EXPORTS_UNAVAILABLE'},{status: 503});}
}
