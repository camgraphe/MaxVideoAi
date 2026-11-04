import { NextResponse } from 'next/server';
import { FEATURES } from '@/content/feature-flags';
import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import type { PublicModelQuoteInput, PublicModelQuote } from '@/lib/pricing-public-model-contract';
import { validateWan3PricingDuration } from '@/lib/wan3-pricing';

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
    !['v2v', 'ref2v', 'i2v'].includes(data.mode)
  )
    return reply(unavailable, 400);
  const input: PublicModelQuoteInput = {
    modelId: 'wan-3-prime',
    mode: data.mode,
    durationSec: data.seconds,
    resolution: '720p',
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
    // An isolated preview can explicitly read the published rate card. Only normalized pricing facts leave it.
    const quote: PublicModelQuote =
      process.env.NODE_ENV === 'development' && process.env.CHARACTER_STUDIO_PREVIEW_PUBLIC_PRICING === '1'
        ? await fetch('https://maxvideoai.com/api/pricing/quote', {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            signal: AbortSignal.timeout(6000),
          }).then(async (response) => (response.ok ? response.json() : unavailable))
        : await quotePublicModelScenario(input);
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
