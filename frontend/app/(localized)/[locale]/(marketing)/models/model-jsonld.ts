import type { EngineAvailability } from '@/types/engines';
import { getFalEngineBySlug } from '@/config/falEngines';

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';

const AVAILABILITY_MAP: Record<EngineAvailability, string> = {
  available: 'https://schema.org/InStock',
  limited: 'https://schema.org/LimitedAvailability',
  waitlist: 'https://schema.org/PreOrder',
  paused: 'https://schema.org/Discontinued',
};

export function buildModelServiceJsonLd(slug: string) {
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return null;
  }

  const url = `${SITE}${engine.seo.canonicalPath}`;
  const description =
    engine.seo?.description ?? engine.seoText ?? 'Generate AI videos with this model on MaxVideoAI.';
  const serviceType = `AI Video Generation with ${engine.marketingName}`;
  const name = engine.cardTitle ?? engine.marketingName;
  const availability = AVAILABILITY_MAP[engine.availability] ?? AVAILABILITY_MAP.limited;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType,
    name,
    description,
    provider: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
      logo: 'https://maxvideoai.com/favicon-512.png',
    },
    areaServed: 'Worldwide',
    url,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: '10.00',
      availability,
      url,
    },
  };
}

export function serializeJsonLd(data: object): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildModelFaqJsonLd(slug: string) {
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return null;
  }

  const baseEntries =
    engine.faqs?.map(({ question, answer }) => ({
      '@type': 'Question' as const,
      name: question,
      acceptedAnswer: {
        '@type': 'Answer' as const,
        text: answer,
      },
    })) ?? [];

  if (baseEntries.length === 0) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: baseEntries,
  };
}
