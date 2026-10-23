import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createVideoExcerptPostHandler } from '@/server/video-excerpts/http';
import { readVideoExcerptSource } from '@/server/video-excerpts/source-access';
export const runtime = 'nodejs';
export const POST = createVideoExcerptPostHandler({
  userId: async request => (await getRouteAuthContext(request)).userId,
  prepare: readVideoExcerptSource,
});
