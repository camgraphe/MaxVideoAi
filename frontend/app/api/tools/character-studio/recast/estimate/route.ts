import { NextResponse } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { readRecastPublicPrice } from '@/server/character-studio/recast-public-price';
import type { PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { validateWan3PricingDuration } from '@/lib/wan3-pricing';

import { RECAST_RESOLUTIONS, RECAST_FRAMINGS } from '@/lib/character-studio-recast-format';

const unavailable = { status: 'unavailable' } as const;
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Read-only estimate. The paid quote must measure owned source media again before reservation. */
export async function POST(request: Request) {
  if (!FEATURES.workflows.toolsSection) return reply(unavailable, 404);
  const data = await request.json().catch(() => null);
  if (
    !data ||
    !Number.isInteger(data.seconds) ||
    typeof data.sourceSeconds !== 'number' ||
    typeof data.audio !== 'boolean' ||
    !['v2v', 'ref2v', 'i2v'].includes(data.mode) ||
    !RECAST_RESOLUTIONS.includes(data.resolution ?? '720p') ||
    !RECAST_FRAMINGS.includes(data.aspectRatio ?? 'auto')
  )
    return reply(unavailable, 400);
  const input: PublicModelQuoteInput = {
    modelId: 'wan-3-prime',
    mode: data.mode,
    durationSec: data.seconds,
    resolution: data.resolution ?? '720p',
    aspectRatio: data.aspectRatio === 'auto' ? undefined : data.aspectRatio,
    audio: data.audio,
    ...(data.mode !== 'i2v' ? { inputVideoDurationSec: data.sourceSeconds } : {}),
  };
  try {
    validateWan3PricingDuration({
      mode: input.mode,
      durationSec: input.durationSec,
      inputVideoDurationSec: data.sourceSeconds,
    });
    if (input.mode !== 'v2v' && data.sourceSeconds !== 0) return reply(unavailable, 400);
  } catch {
    return reply(unavailable, 400);
  }
  try {
    const quote = await readRecastPublicPrice(input);
    if (
      quote.status !== 'exact' ||
      !Number.isSafeInteger(quote.amountCents) ||
      quote.amountCents < 0 ||
      quote.currency !== 'USD'
    ) {
      return reply(unavailable);
    }
    return reply({
      status: 'estimated',
      amountCents: quote.amountCents,
      currency: quote.currency,
      revision: quote.revision,
    });
  } catch {
    return reply(unavailable);
  }
}
