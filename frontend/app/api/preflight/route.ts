import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { resolveMediaAwarePreflight } from './_lib/media-aware-preflight';

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  const res = await resolveMediaAwarePreflight({
    request: payload,
    resolveUserId: async () => (await getRouteAuthContext(req)).userId,
  });
  const status = res.ok ? 200 : 400;
  return NextResponse.json(res, { status });
}
