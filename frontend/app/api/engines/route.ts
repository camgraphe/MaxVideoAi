import { NextResponse, type NextRequest } from 'next/server';
import { getPublicConfiguredEnginesByCategory } from '@/server/engines';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';
import { getBaseEnginesByCategory } from '@/lib/engines';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rawCategory = request.nextUrl.searchParams.get('category') ?? 'video';
  const category = rawCategory === 'image' || rawCategory === 'all' ? rawCategory : 'video';
  const includeAverages =
    category !== 'image' && request.nextUrl.searchParams.get('includeAverages') === '1';
  try {
    const [engines, averages] = await Promise.all([
      getPublicConfiguredEnginesByCategory(category),
      includeAverages ? fetchEngineAverageDurations() : Promise.resolve([]),
    ]);
    const averageMap = new Map(averages.map((entry) => [entry.engineId, entry.averageDurationMs]));
    const payload = engines.map((engine) => ({
      ...engine,
      avgDurationMs: averageMap.get(engine.id) ?? null,
    }));
    return NextResponse.json({ ok: true, engines: payload });
  } catch (error) {
    console.error('[api/engines] failed to load configured engines, falling back to base registry', error);
    const payload = getBaseEnginesByCategory(category).map((engine) => ({
      ...engine,
      avgDurationMs: null,
    }));
    return NextResponse.json({ ok: true, engines: payload, degraded: true });
  }
}
