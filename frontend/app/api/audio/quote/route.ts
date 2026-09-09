import { NextRequest, NextResponse } from 'next/server';
import { getRouteAuthContext } from '@/lib/supabase-ssr';
import { prepareAudioRun } from '@/server/audio/prepare-audio';
import { AudioGenerationError } from '@/server/audio/audio-generate-validation';

export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const { userId } = await getRouteAuthContext(req);
  if (!userId) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 });
  try {
    const prepared = await prepareAudioRun(body, userId);
    return NextResponse.json({ ok: true, pricing: prepared.pricingSnapshot, inputKey: prepared.inputKey, expiresAt: Date.now() + 60_000 }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof AudioGenerationError ? error.code : 'audio_quote_failed', message: error instanceof AudioGenerationError ? error.message : 'Unable to quote audio.' }, { status: error instanceof AudioGenerationError ? error.status : 503 });
  }
}
