import { NextResponse, type NextRequest } from 'next/server';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rawCategory = request.nextUrl.searchParams.get('category') ?? 'video';
  const category = rawCategory === 'image' || rawCategory === 'all' ? rawCategory : 'video';

  if (category === 'image') {
    return NextResponse.json({ ok: true, averages: {} });
  }

  try {
    const averages = await fetchEngineAverageDurations();
    return NextResponse.json({
      ok: true,
      averages: Object.fromEntries(averages.map((entry) => [entry.engineId, entry.averageDurationMs])),
    });
  } catch (error) {
    console.warn('[api/engines/averages] failed to load averages', error);
    return NextResponse.json({ ok: true, averages: {}, degraded: true });
  }
}
