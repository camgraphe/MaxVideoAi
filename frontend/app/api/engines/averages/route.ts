import { NextResponse, type NextRequest } from 'next/server';
import { fetchGenerationTimingMatrix } from '@/server/generation-timing';
import { selectGenerationTiming } from '@/lib/generation-timing';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rawCategory = request.nextUrl.searchParams.get('category') ?? 'video';
  const category = rawCategory === 'image' || rawCategory === 'all' ? rawCategory : 'video';

  if (category === 'image') {
    return NextResponse.json({ ok: true, averages: {} });
  }

  try {
    try {
      const matrix = await fetchGenerationTimingMatrix();
      const estimates = Object.entries(matrix).flatMap(([engineId, cells]) => {
        const estimate = selectGenerationTiming(cells, {});
        return estimate ? [{ engineId, ...estimate }] : [];
      });
      return NextResponse.json({
        ok: true, source: 'completion_event', matrix,
        samples: Object.fromEntries(estimates.map((entry) => [entry.engineId, entry.sampleCount])),
        averages: Object.fromEntries(estimates.map((entry) => [entry.engineId, entry.averageDurationMs])),
      });
    } catch (error) {
      // Rolling deployment before migration 45 retains the existing optional estimate.
      console.warn('[api/engines/averages] timing matrix unavailable; using legacy observations', error);
    }
    const averages = await fetchEngineAverageDurations();
    return NextResponse.json({
      ok: true,
      source: 'completion_event',
      samples: Object.fromEntries(averages.map((entry) => [entry.engineId, entry.completedCount])),
      averages: Object.fromEntries(averages.map((entry) => [entry.engineId, entry.averageDurationMs])),
    });
  } catch (error) {
    console.warn('[api/engines/averages] failed to load averages', error);
    return NextResponse.json({ ok: true, averages: {}, degraded: true });
  }
}
