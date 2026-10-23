import { createVideoExcerptPostHandler } from '@/server/video-excerpts/http';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const POST = createVideoExcerptPostHandler();
