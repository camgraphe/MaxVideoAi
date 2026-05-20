import { generateVideoPagesSitemapResponse } from '@/server/sitemaps/video-pages';

export async function GET() {
  return generateVideoPagesSitemapResponse();
}
