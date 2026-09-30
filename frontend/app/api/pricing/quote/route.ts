import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import type { PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import { ltx25AudioTariffBounds } from '@/lib/ltx25-audio-tariff';
import { supportsOmniTariffMedia } from '@/lib/pricing-audit/omni-tariff-scenario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPTIONAL_TEXT = ['aspectRatio', 'quality'] as const;
const OPTIONAL_NUMBER = ['quantity', 'referenceImageCount', 'inputVideoDurationSec',
  'inputAudioDurationSec', 'inheritedDurationSec', 'referenceTokenBudget'] as const;

function parseInput(payload: unknown): PublicModelQuoteInput | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const body = payload as Record<string, unknown>;
  const fractionalMedia = typeof body.modelId === 'string' && typeof body.mode === 'string'
    && (ltx25AudioTariffBounds(body.modelId, body.mode) || (supportsOmniTariffMedia(body.modelId, body.mode) && body.mode !== 'extend'));
  if (typeof body.modelId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.modelId) ||
      typeof body.mode !== 'string' || !/^[a-z0-9-]{1,30}$/.test(body.mode) ||
      typeof body.resolution !== 'string' || !/^[a-zA-Z0-9_]{1,30}$/.test(body.resolution) ||
      (body.durationOption !== undefined && body.durationOption !== 'auto') ||
      !Number.isFinite(body.durationSec) || (!fractionalMedia && !Number.isInteger(body.durationSec))
      || Number(body.durationSec) < 1 || Number(body.durationSec) > 120 ||
      (body.audio !== undefined && typeof body.audio !== 'boolean') ||
      (body.hasVideoInput !== undefined && typeof body.hasVideoInput !== 'boolean') ||
      (body.voiceControl !== undefined && typeof body.voiceControl !== 'boolean') ||
      (body.hdr !== undefined && typeof body.hdr !== 'boolean') ||
      (body.exrExport !== undefined && typeof body.exrExport !== 'boolean') ||
      OPTIONAL_TEXT.some((key) => body[key] !== undefined &&
        (typeof body[key] !== 'string' || (body[key] as string).length > 40)) ||
      OPTIONAL_NUMBER.some((key) => body[key] !== undefined &&
        (!Number.isFinite(body[key]) || Number(body[key]) < 0 || Number(body[key]) > 10000))) return null;
  return body as PublicModelQuoteInput;
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? '0') > 2048) {
    return NextResponse.json({ status: 'unavailable' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }
  const input = parseInput(await req.json().catch(() => null));
  if (!input) return NextResponse.json({ status: 'unavailable' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(await quotePublicModelScenario(input), { headers: { 'Cache-Control': 'no-store' } });
}
