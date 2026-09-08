import type { NextRequest } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { studioJson } from './studio-route-utils';

export async function handleStudioChatPost(
  req: NextRequest,
  resolveAuth: (request: NextRequest) => Promise<{ userId: string | null }> = getRouteAuthContext
) {
  const { userId } = await resolveAuth(req);
  if (!userId) {
    return studioJson({ ok: false, error: 'UNAUTHORIZED', message: 'Authentication required.' }, { status: 401 });
  }

  // Chat has no canonical quote/reservation contract yet. Never trust a client
  // quote or mode to authorize provider work. Mock runs only in the local editor.
  return studioJson({
    ok: false,
    error: 'STUDIO_CHAT_LIVE_UNAVAILABLE',
    message: 'Live Chat is unavailable until pricing authorization is supported. Use local Simulation.',
  }, { status: 503 });
}
