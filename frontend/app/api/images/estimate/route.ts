import { NextRequest, NextResponse } from 'next/server';
import { listFalEngines } from '@/config/falEngines';
import type { ImageGenerationMode } from '@/types/image-generation';
import { computePricingSnapshot } from '@/lib/pricing';
import { getRouteAuthContext } from '@/lib/supabase-ssr';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'auth_required' }, { status: 401 });
  }

  let body: { engineId?: string; mode?: ImageGenerationMode; numImages?: number } | null = null;
  try {
    body = (await req.json()) as { engineId?: string; mode?: ImageGenerationMode; numImages?: number } | null;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const engineId = typeof body?.engineId === 'string' ? body.engineId : null;
  const mode = body?.mode === 'i2i' || body?.mode === 't2i' ? body.mode : 't2i';
  const requestedImages =
    typeof body?.numImages === 'number' && Number.isFinite(body.numImages) ? Math.round(body.numImages) : 1;
  const numImages = Math.min(8, Math.max(1, requestedImages));

  const engineEntry = listFalEngines().find((entry) => entry.id === engineId);
  if (!engineEntry || (engineEntry.category ?? 'video') !== 'image') {
    return NextResponse.json({ ok: false, error: 'engine_unavailable' }, { status: 404 });
  }

  const engineCaps = engineEntry.engine;
  const modeConfig = engineEntry.modes.find((entry) => entry.mode === mode);
  if (!modeConfig) {
    return NextResponse.json({ ok: false, error: 'mode_unsupported' }, { status: 400 });
  }

  try {
    const pricing = await computePricingSnapshot({
      engine: engineCaps,
      durationSec: numImages,
      resolution:
        engineCaps.resolutions.find((resolution) => resolution === 'square_hd') ??
        engineCaps.resolutions[0] ??
        'square_hd',
      currency: engineCaps.pricing?.currency ?? 'USD',
    });

    return NextResponse.json({ ok: true, pricing });
  } catch (error) {
    console.error('[images] price estimation failed', error);
    return NextResponse.json({ ok: false, error: 'pricing_error' }, { status: 500 });
  }
}
