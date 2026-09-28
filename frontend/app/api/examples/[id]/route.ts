import { NextResponse } from 'next/server';
import { getExampleWatchDetail } from '@/server/example-watch-detail-loader';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id || id.length > 200) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const detail = await getExampleWatchDetail(id);
    return NextResponse.json(detail ? { detail } : { error: 'Not found' }, {
      status: detail ? 200 : 404, headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
