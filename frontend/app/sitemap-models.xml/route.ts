import { NextResponse } from 'next/server';
import { buildModelsSitemapXml } from '@/lib/sitemapData';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  const xml = await buildModelsSitemapXml();
  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
