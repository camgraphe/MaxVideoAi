import { localePathnames, type AppLocale } from '@/i18n/locales';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';

export function buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale }: { canonical: string; locale: AppLocale }) {
  const labels = getBreadcrumbLabels(locale);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: labels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Pay-as-you-go AI Video Generator',
        item: canonical,
      },
    ],
  };
}

export function buildPayAsYouGoServiceJsonLd({ canonical }: { canonical: string }) {
  return buildMarketingServiceJsonLd({
    name: 'Pay-as-you-go AI Video Generator',
    description:
      'Generate AI videos from text, images, or video with no subscription required, price-before-generation quotes, and failed-render refunds.',
    serviceType: 'Pay-as-you-go AI video generation',
    category: 'AI video generator',
    url: canonical,
    offers: {
      priceCurrency: 'USD',
      price: '10.00',
      availability: 'https://schema.org/InStock',
      description: 'Starter credits are available without a recurring subscription.',
      url: canonical,
    },
  });
}

export function buildPayAsYouGoWebApplicationJsonLd({ canonical }: { canonical: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonical,
    description:
      'Pay-as-you-go AI video generator for comparing multiple AI video models with upfront pricing and no required subscription.',
    offers: {
      '@type': 'Offer',
      price: '10.00',
      priceCurrency: 'USD',
      description: 'Starter credits are available without a recurring subscription.',
      url: canonical,
    },
    featureList: [
      'Generate AI videos from text, images, or video',
      'Compare Seedance 2, Kling, Google Veo, Happy Horse 1.1, Seedance 2 Mini, LTX, Wan and other models',
      'See the estimated price before generation',
      'Use credits for completed renders',
    ],
  };
}
