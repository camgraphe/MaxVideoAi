import { NextResponse } from 'next/server';
import { isDatabaseConfigured } from '@/lib/db';
import { listEligibleSeoWatchVideos } from '@/server/video-seo';
import { buildVideoPagesSitemapXml } from './video-xml';

export { buildVideoPagesSitemapXml } from './video-xml';

export async function generateVideoPagesSitemapResponse(): Promise<NextResponse> {
  if (!isDatabaseConfigured()) {
    return new NextResponse('Database unavailable', { status: 503 });
  }

  try {
    const watchVideos = await listEligibleSeoWatchVideos();
    const xml = buildVideoPagesSitemapXml(watchVideos);

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[sitemap-video-pages] failed', error);
    return new NextResponse('Server error', { status: 500 });
  }
}
