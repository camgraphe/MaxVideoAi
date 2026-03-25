import { NextResponse, type NextRequest } from 'next/server';
import { getPublicConfiguredEnginesByCategory } from '@/server/engines';
import { getBaseEnginesByCategory } from '@/lib/engines';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rawCategory = request.nextUrl.searchParams.get('category') ?? 'video';
  const category = rawCategory === 'image' || rawCategory === 'all' ? rawCategory : 'video';
  try {
    const engines = await getPublicConfiguredEnginesByCategory(category);
    const payload = engines.map((engine) => ({
      ...engine,
      avgDurationMs: engine.avgDurationMs ?? null,
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
