import type { AppLocale } from '@/i18n/locales';
import type { PublicModelQuote, PublicModelQuoteInput } from '@/lib/pricing-public-model-contract';
import { quotePublicModelScenario } from '@/server/pricing/quote-public-model-scenario';

import { formatCurrencyForLocale } from '../../pricing/_lib/pricingPageContent';
import { buildHomePriceDemo } from './home-price-demo-data';

/** The illustrative home controls use the same exact amount as live billing. */
export async function buildCurrentHomePriceDemo(
  locale: AppLocale,
  quote: (input: PublicModelQuoteInput) => Promise<PublicModelQuote> = quotePublicModelScenario,
) {
  const [demo] = buildHomePriceDemo(locale);
  if (!demo) return [];
  const quotes = await Promise.all(demo.steps.map((step) => quote({ modelId: demo.engine.id,
    mode: 't2v', durationSec: step.seconds, resolution: step.resolution, audio: true })));
  if (quotes.some((current) => current.status !== 'exact')) return [];
  return [{ ...demo, steps: demo.steps.map((step, index) => {
    const current = quotes[index];
    return current?.status === 'exact' ? { ...step, amountCents: current.amountCents,
      display: formatCurrencyForLocale(locale, current.currency, current.amountCents / 100) } : step;
  }) }];
}
