import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FEATURES } from '@/content/feature-flags';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { findOwnedFinishingSource } from '@/server/tools/finishing-source';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) return NextResponse.json({ ok: false }, { status: 404 });
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const { url } = z.object({ url: z.string().url().max(8192) }).strict().parse(await req.json());
    return NextResponse.json({ ok: true, ...await findOwnedFinishingSource(userId, url) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ ok: false, error: 'Source unavailable.' }, { status: 422 }); }
}
