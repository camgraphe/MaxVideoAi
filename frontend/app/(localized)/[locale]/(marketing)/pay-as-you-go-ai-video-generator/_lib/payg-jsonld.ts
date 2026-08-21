import { localePathnames, type AppLocale } from '@/i18n/locales';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import type { PayAsYouGoContent } from '../_content/types';

export function buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale, copy }: { canonical: string; locale: AppLocale; copy: PayAsYouGoContent['jsonLd'] }) {
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
        name: copy.breadcrumbName,
        item: canonical,
      },
    ],
  };
}

export function buildPayAsYouGoServiceJsonLd({ canonical, copy }: { canonical: string; copy: PayAsYouGoContent['jsonLd'] }) {
  return buildMarketingServiceJsonLd({
    name: copy.service.name,
    description: copy.service.description,
    serviceType: copy.service.serviceType,
    category: copy.service.category,
    url: canonical,
    offers: {
      priceCurrency: 'USD',
      price: '10.00',
      availability: 'https://schema.org/InStock',
      description: copy.service.offer,
      url: canonical,
    },
  });
}

export function buildPayAsYouGoWebApplicationJsonLd({ canonical, copy }: { canonical: string; copy: PayAsYouGoContent['jsonLd'] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    url: canonical,
    description: copy.webApplication.description,
    offers: {
      '@type': 'Offer',
      price: '10.00',
      priceCurrency: 'USD',
      description: copy.webApplication.offer,
      url: canonical,
    },
    featureList: copy.webApplication.features,
  };
}
