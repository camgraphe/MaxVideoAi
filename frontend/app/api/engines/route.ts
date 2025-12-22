import { NextResponse, type NextRequest } from 'next/server';
import { getConfiguredEnginesByCategory } from '@/server/engines';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rawCategory = request.nextUrl.searchParams.get('category') ?? 'video';
  const category = rawCategory === 'image' || rawCategory === 'all' ? rawCategory : 'video';
  const includeAverages = category !== 'image';
  const [engines, averages] = await Promise.all([
    getConfiguredEnginesByCategory(category),
    includeAverages ? fetchEngineAverageDurations() : Promise.resolve([]),
  ]);
  const averageMap = new Map(averages.map((entry) => [entry.engineId, entry.averageDurationMs]));
  const payload = engines.map((engine) => ({
    ...engine,
    avgDurationMs: averageMap.get(engine.id) ?? null,
  }));
  return NextResponse.json({ ok: true, engines: payload });
}
