import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

const APPLE_ASSOCIATION_PAYLOAD = {} satisfies Record<string, unknown>;

export async function GET() {
  return NextResponse.json(APPLE_ASSOCIATION_PAYLOAD, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
