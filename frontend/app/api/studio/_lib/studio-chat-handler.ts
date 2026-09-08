import type { NextRequest } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/server/admin';
import { studioJson } from './studio-route-utils';

type StudioChatAccess = { userId: string | null; deniedStatus?: number };

async function resolveStudioChatAdmin(request: NextRequest): Promise<StudioChatAccess> {
  try {
    return { userId: await requireAdmin(request) };
  } catch (error) {
    return {
      userId: null,
      deniedStatus: error instanceof AdminAuthError ? error.status : 500,
    };
  }
}

export async function handleStudioChatPost(
  req: NextRequest,
  resolveAuth: (request: NextRequest) => Promise<StudioChatAccess> = resolveStudioChatAdmin
) {
  const { userId, deniedStatus } = await resolveAuth(req);
  if (!userId) {
    const status = deniedStatus ?? 401;
    const error = status === 403 ? 'FORBIDDEN' : status === 401 ? 'UNAUTHORIZED' : 'ACCESS_CHECK_FAILED';
    return studioJson({ ok: false, error, message: status === 403 ? 'Administrator access required.' : 'Authentication required.' }, { status });
  }

  // Chat has no canonical quote/reservation contract yet. Never trust a client
  // quote or mode to authorize provider work. Mock runs only in the local editor.
  return studioJson({
    ok: false,
    error: 'STUDIO_CHAT_LIVE_UNAVAILABLE',
    message: 'Live Chat is unavailable until pricing authorization is supported. Use local Simulation.',
  }, { status: 503 });
}
