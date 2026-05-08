import type { FaqItem, ProviderItem } from '@/components/marketing/home/HomeRedesignSections';
import type { RedesignContent } from './home-route-data';

export function buildSoftwareSchema(content: RedesignContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'VideoEditorApplication',
    operatingSystem: 'Web',
    url: 'https://maxvideoai.com',
    description: content.hero.subtitle,
    offers: {
      '@type': 'Offer',
      price: '10.00',
      priceCurrency: 'USD',
      description: content.pricingTrust.subtitle,
    },
    featureList: [
      'Pay-as-you-go multi-engine AI video generation workspace',
      'Compare AI video models before generating',
      'Live price before you generate',
      'Text-to-video, image-to-video, video-to-video and reference workflows',
      'Auto-refunds on failed generation jobs',
    ],
  };
}

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MaxVideo AI',
    url: 'https://maxvideoai.com',
    logo: 'https://maxvideoai.com/favicon-512.png',
    sameAs: [],
    description:
      'Independent hub for AI video generation. Price before you generate. Works with Seedance, Kling, Veo, LTX, Wan, Pika, Sora and more.',
  };
}

export function buildFaqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildItemListSchema(content: RedesignContent, providers: ProviderItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: content.providers.title,
    itemListElement: providers.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${item.provider} ${item.model}`,
    })),
  };
}
