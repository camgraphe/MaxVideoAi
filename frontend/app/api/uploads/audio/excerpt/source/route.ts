import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createVideoExcerptPostHandler } from '@/server/video-excerpts/http';
import { readMediaExcerptSource } from '@/server/video-excerpts/source-access';

export const runtime = 'nodejs';
export const POST = createVideoExcerptPostHandler({
  userId: async request => (await getRouteAuthContext(request)).userId,
  prepare: (userId, input) => readMediaExcerptSource(userId, input, 'audio'),
});
