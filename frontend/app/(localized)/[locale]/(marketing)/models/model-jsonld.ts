import { getFalEngineBySlug } from '@/config/falEngines';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { isImageOnlyModel, supportsAudioGeneration, supportsVideoGeneration } from '@/lib/models/catalog';

const SITE = SITE_ORIGIN.replace(/\/$/, '');

export function buildModelServiceJsonLd(slug: string) {
  const engine = getFalEngineBySlug(slug);
  if (!engine) {
    return null;
  }

  const url = `${SITE}${engine.seo.canonicalPath}`;
  const isImageModel = isImageOnlyModel(engine);
  const serviceType = isImageModel
    ? `AI Image Generation with ${engine.marketingName}`
    : supportsAudioGeneration(engine) && !supportsVideoGeneration(engine)
      ? `AI Audio Generation with ${engine.marketingName}`
      : `AI Video Generation with ${engine.marketingName}`;
  const description =
    engine.seo?.description ??
    engine.seoText ??
    (isImageModel
      ? 'Generate AI still images with this model on MaxVideoAI.'
      : 'Generate AI videos with this model on MaxVideoAI.');
  const name = engine.cardTitle ?? engine.marketingName;

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
