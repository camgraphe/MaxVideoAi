import type { AppLocale } from '@/i18n/locales';
import type { FaqItem, ProviderItem } from '@/components/marketing/home/HomeRedesignSections';
import type { RedesignContent } from './home-route-data';
import { buildSiteOrganizationReference } from '@/lib/seo/site-organization-schema';

const SOFTWARE_FEATURES: Record<AppLocale, string[]> = {
  en: [
    'Pay-as-you-go multi-engine AI video generation workspace',
    'Compare AI video models before generating',
    'Live price before you generate',
    'Text-to-video, image-to-video, video-to-video and reference workflows',
    'Automatic credit refunds on technically failed generation jobs',
  ],
  fr: [
    'Espace de génération vidéo IA multi-modèles au paiement à l’usage',
    'Comparaison des modèles vidéo IA avant de générer',
    'Prix exact affiché avant de générer',
    'Génération à partir de texte, d’images, de vidéos et de références',
    'Crédits automatiquement recrédités en cas d’échec technique de génération',
  ],
  es: [
    'Espacio de generación de vídeo con IA con varios modelos y pago por uso',
    'Comparación de modelos de vídeo con IA antes de generar',
    'Precio exacto antes de generar',
    'Generación a partir de texto, imágenes, vídeos y referencias',
    'Devolución automática de créditos en caso de fallo técnico de generación',
  ],
};

export function buildSoftwareSchema(content: RedesignContent, locale: AppLocale = 'en') {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'VideoEditorApplication',
    operatingSystem: 'Web',
    url: `https://maxvideoai.com${locale === 'en' ? '' : `/${locale}`}`,
    inLanguage: locale,
    description: content.hero.subtitle,
    provider: buildSiteOrganizationReference(),
    featureList: SOFTWARE_FEATURES[locale],
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
