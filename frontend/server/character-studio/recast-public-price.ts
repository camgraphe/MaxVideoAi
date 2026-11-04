import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';
import type { PublicModelQuoteInput, PublicModelQuote } from '@/lib/pricing-public-model-contract';

/** Price facts only. Never send the account, prompt, media IDs, names or URLs to the public rate reader. */
export async function readRecastPublicPrice(input: PublicModelQuoteInput): Promise<PublicModelQuote> {
  if (process.env.NODE_ENV !== 'development' || process.env.CHARACTER_STUDIO_PREVIEW_PUBLIC_PRICING !== '1') {
    return quotePublicModelScenario(input);
  }
  const response = await fetch('https://maxvideoai.com/api/pricing/quote', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(6000),
  });
  return response.ok ? response.json() : { status: 'unavailable' };
}
