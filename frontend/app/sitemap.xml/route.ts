import { NextResponse } from 'next/server';
import { buildSitemapIndexXml } from '@/lib/sitemapData';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  try {
    const xml = await buildSitemapIndexXml();
    const sitemapCount = (xml.match(/<sitemap>/g) ?? []).length;
    if (sitemapCount < 3) {
      return new NextResponse('Sitemap index returned too few sitemaps.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
          'Cache-Control': 'no-store',
          'X-Sitemap-Index-Count': String(sitemapCount),
        },
      });
    }
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Sitemap-Index-Count': String(sitemapCount),
      },
    });
  } catch (error) {
    console.error('[sitemap-index] generation failed', error);
    return new NextResponse('Sitemap index generation failed.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
