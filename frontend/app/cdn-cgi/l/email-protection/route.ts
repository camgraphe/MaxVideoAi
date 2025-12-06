import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-static';

export async function GET() {
  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'Cache-Control': 'public, max-age=60, must-revalidate',
      'Content-Type': 'text/plain; charset=UTF-8',
    },
  });
}
