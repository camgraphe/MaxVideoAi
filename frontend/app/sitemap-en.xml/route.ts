import { NextResponse } from 'next/server';
import { buildLocaleSitemapXml } from '@/lib/sitemapData';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  try {
    const xml = await buildLocaleSitemapXml('en');
    const urlCount = (xml.match(/<url>/g) ?? []).length;
    if (urlCount < 10) {
      return new NextResponse('Sitemap generation returned too few URLs.', {
        status: 503,
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
          'Cache-Control': 'no-store',
          'X-Sitemap-Url-Count': String(urlCount),
        },
      });
    }
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
        'CDN-Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
        'X-Sitemap-Url-Count': String(urlCount),
      },
    });
  } catch (error) {
    console.error('[sitemap-en] generation failed', error);
    return new NextResponse('Sitemap generation failed.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=UTF-8',
        'Cache-Control': 'no-store',
      },
    });
  }
}
