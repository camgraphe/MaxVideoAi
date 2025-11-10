import { generateVideoSitemapResponse } from '@/server/sitemaps/video';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return generateVideoSitemapResponse();
}
