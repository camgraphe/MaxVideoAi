import { NextRequest, NextResponse } from 'next/server';
import { listStarterMedia } from '@/server/starter-media';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const surface = request.nextUrl.searchParams.get('surface');
  if (surface !== 'image' && surface !== 'audio') return NextResponse.json({ error: 'Invalid surface' }, { status: 400 });
  return NextResponse.json({ items: await listStarterMedia(surface) }, { headers: { 'Cache-Control': 'no-store' } });
}
