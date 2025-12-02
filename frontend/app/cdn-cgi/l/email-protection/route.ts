import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-static';

export async function GET() {
  return new NextResponse('', {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  });
}
