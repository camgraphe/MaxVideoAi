import type { NextRequest } from 'next/server';
import {
  resolveStudioApiAccess,
  type StudioAccessDecision,
} from '@/server/studio/access';
import { studioJson } from './studio-route-utils';

export async function handleStudioChatPost(
  req: NextRequest,
  resolveAccess: (request: NextRequest) => Promise<StudioAccessDecision> = resolveStudioApiAccess,
) {
  const access = await resolveAccess(req);
  if (!access.ok) {
    const message = access.status === 403
      ? 'Administrator access required.'
      : access.status === 404
        ? 'Studio is unavailable.'
        : access.status === 500
          ? 'Studio access could not be verified.'
          : 'Authentication required.';
    return studioJson({ ok: false, error: access.error, message }, { status: access.status });
  }

  // Chat has no canonical quote/reservation contract yet. Never trust a client
  // quote or mode to authorize provider work. Mock runs only in the local editor.
  return studioJson({
    ok: false,
    error: 'STUDIO_CHAT_LIVE_UNAVAILABLE',
    message: 'Live Chat is unavailable until pricing authorization is supported. Use local Simulation.',
  }, { status: 503 });
}
