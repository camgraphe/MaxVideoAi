import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { isImageOnlyModel, supportsAudioGeneration, supportsVideoGeneration } from '@/lib/models/catalog';
import type { FalEngineEntry } from '@/config/falEngines';
import { SITE } from './model-page-links';

const PROVIDER_INFO_MAP: Record<string, { name: string; url: string }> = {
  luma: { name: 'Luma AI', url: 'https://lumalabs.ai' },
  openai: { name: 'OpenAI', url: 'https://openai.com' },
  'google-veo': { name: 'Google DeepMind', url: 'https://deepmind.google/technologies/veo/' },
  pika: { name: 'Pika Labs', url: 'https://pika.art' },
  minimax: { name: 'MiniMax', url: 'https://www.minimaxi.com' },
  kling: { name: 'Kling by Kuaishou', url: 'https://www.kuaishou.com/en' },
  wan: { name: 'Wan AI', url: 'https://www.wan-ai.com' },
  lightricks: { name: 'Lightricks', url: 'https://www.lightricks.com' },
  alibaba: { name: 'Alibaba', url: 'https://www.alibabagroup.com' },
};

const AVAILABILITY_SCHEMA_MAP: Record<string, string> = {
  available: 'https://schema.org/InStock',
  limited: 'https://schema.org/LimitedAvailability',
  waitlist: 'https://schema.org/LimitedAvailability',
  paused: 'https://schema.org/Discontinued',
};

export function resolveProviderInfo(engine: FalEngineEntry) {
  const fallback = PARTNER_BRAND_MAP.get(engine.brandId);
  const override = PROVIDER_INFO_MAP[engine.brandId];
  return {
    name: override?.name ?? fallback?.label ?? engine.brandId,
    url: override?.url ?? fallback?.availabilityLink ?? SITE,
  };
}

function buildOfferSchema(canonical: string, engine: FalEngineEntry) {
  const imageModel = isImageOnlyModel(engine);
  return {
    '@type': 'Offer',
    url: canonical,
    priceCurrency: 'USD',
    price: '0',
    availability: AVAILABILITY_SCHEMA_MAP[engine.availability] ?? AVAILABILITY_SCHEMA_MAP.limited,
    description: imageModel
      ? 'Pay-as-you-go pricing (varies by provider, output size, and request options).'
      : 'Pay-as-you-go pricing (varies by provider and duration).',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: 0,
      priceCurrency: 'USD',
      referenceQuantity: {
        '@type': 'QuantitativeValue',
        value: 1,
        unitCode: imageModel ? 'C62' : 'SEC',
      },
    },
  };
}

export function buildProductSchema({
  engine,
  canonical,
  description,
  heroTitle,
  heroPosterAbsolute,
}: {
  engine: FalEngineEntry;
  canonical: string;
  description: string;
  heroTitle: string;
  heroPosterAbsolute: string | null;
}) {
  const provider = resolveProviderInfo(engine);
  const offer = buildOfferSchema(canonical, engine);
  const category = isImageOnlyModel(engine)
    ? 'AI Image Generator'
    : supportsAudioGeneration(engine) && !supportsVideoGeneration(engine)
      ? 'AI Audio Generator'
      : 'AI Video Generator';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: heroTitle,
    description,
    category,
    url: canonical,
    image: heroPosterAbsolute ? [heroPosterAbsolute] : undefined,
    brand: {
      '@type': 'Brand',
      name: provider.name,
      url: provider.url,
    },
    manufacturer: {
      '@type': 'Organization',
      name: provider.name,
      url: provider.url,
    },
    offers: offer,
  };
}

