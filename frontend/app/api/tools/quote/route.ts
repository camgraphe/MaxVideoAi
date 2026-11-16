import { NextRequest, NextResponse } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { quoteToolboxRequest } from '@/server/tools/toolbox-quote';
import { UpscaleToolError } from '@/server/tools/upscale-errors';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!FEATURES.workflows.toolsSection) return NextResponse.json({ ok: false, error: 'Tools unavailable.' }, { status: 404 });
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 });
  try {
    const quote = await quoteToolboxRequest(await req.json(), userId);
    return NextResponse.json({ ok: true, quote }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof UpscaleToolError && error.code === 'UPSCALE_TARGET_NOT_LARGER') {
      return NextResponse.json({ ok: false, error: 'UPSCALE_TARGET_NOT_LARGER' }, { status: 422, headers: { 'Cache-Control': 'private, no-store' } });
    }
    return NextResponse.json({ ok: false, error: 'Unable to quote this source and settings.' }, { status: 422 });
  }
}
