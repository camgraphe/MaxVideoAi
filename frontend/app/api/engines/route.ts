import { NextResponse } from 'next/server';
import { getConfiguredEngines } from '@/server/engines';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [engines, averages] = await Promise.all([
    getConfiguredEngines(),
    fetchEngineAverageDurations(),
  ]);
  const averageMap = new Map(averages.map((entry) => [entry.engineId, entry.averageDurationMs]));
  const payload = engines.map((engine) => ({
    ...engine,
    avgDurationMs: averageMap.get(engine.id) ?? null,
  }));
  return NextResponse.json({ ok: true, engines: payload });
}
