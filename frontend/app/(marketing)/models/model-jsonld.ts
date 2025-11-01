import type { EngineAvailability } from '@/types/engines';
import { getFalEngineBySlug } from '@/config/falEngines';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';

const AVAILABILITY_MAP: Record<EngineAvailability, string> = {
  available: 'https://schema.org/InStock',
  limited: 'https://schema.org/LimitedAvailability',
  waitlist: 'https://schema.org/PreOrder',
  paused: 'https://schema.org/Discontinued',
};

export function buildModelProductJsonLd(slug: string) {
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return null;
  }

  const url = `${SITE}${engine.seo.canonicalPath}`;
  const description =
    engine.seo.description ??
    `${engine.marketingName} AI video generator available on MaxVideoAI. Explore prompts, workflows, and pricing details.`;
  const availability = AVAILABILITY_MAP[engine.availability] ?? AVAILABILITY_MAP.limited;
  const priceCurrency = engine.pricingHint?.currency ?? 'USD';

  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    priceCurrency,
    availability,
    url,
  };

  if (typeof engine.pricingHint?.amountCents === 'number') {
    offers.price = Number.isInteger(engine.pricingHint.amountCents)
      ? (engine.pricingHint.amountCents / 100).toFixed(2)
      : engine.pricingHint.amountCents / 100;
  }

  if (engine.pricingHint?.durationSeconds) {
    offers.duration = `PT${engine.pricingHint.durationSeconds}S`;
  }

  if (engine.pricingHint?.label) {
    offers.description = engine.pricingHint.label;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${engine.marketingName} AI Video Generator`,
    brand: 'MaxVideoAI',
    description,
    url,
    offers,
  };
}

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
