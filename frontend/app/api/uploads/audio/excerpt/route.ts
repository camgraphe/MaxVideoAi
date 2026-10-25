import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { createVideoExcerptPostHandler } from '@/server/video-excerpts/http';
import { prepareAudioExcerpt } from '@/server/video-excerpts/prepare-audio';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = createVideoExcerptPostHandler({
  userId: async request => (await getRouteAuthContext(request)).userId,
  prepare: prepareAudioExcerpt,
});
