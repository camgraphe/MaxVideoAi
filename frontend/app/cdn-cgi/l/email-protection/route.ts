import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  // Cloudflare email obfuscation is disabled; return a fast empty 204 to avoid crawl 404s.
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
    },
  });
}
