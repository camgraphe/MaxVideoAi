import { generateVideoPagesSitemapResponse } from '@/server/sitemaps/video-pages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return generateVideoPagesSitemapResponse();
}
