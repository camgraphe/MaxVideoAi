import { localePathnames, type AppLocale } from '@/i18n/locales';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { MODELS_SLUG_MAP, getModelsScopePath, type ModelsPageScope } from './models-catalog-utils';

type ModelsCatalogJsonLdCard = {
  id: string;
  label: string;
};

type ModelsCatalogJsonLdFaqItem = {
  question: string;
  answer: string;
};

function buildCatalogPaths(activeLocale: AppLocale, scope: ModelsPageScope) {
  const localePrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale]}` : '';
  const modelsBasePath = `${localePrefix}/${MODELS_SLUG_MAP[activeLocale] ?? MODELS_SLUG_MAP.en ?? 'models'}`.replace(
    /\/{2,}/g,
    '/'
  );
  const modelsPath = `${localePrefix}${getModelsScopePath(scope, activeLocale)}`.replace(/\/{2,}/g, '/');

  return {
    homeUrl: `${SITE_BASE_URL}${localePrefix || ''}`,
    modelsBasePath,
    modelsBaseUrl: `${SITE_BASE_URL}${modelsBasePath}`,
    modelsUrl: `${SITE_BASE_URL}${modelsPath}`,
  };
}

export function buildModelsCatalogBreadcrumbJsonLd({
  activeLocale,
  breadcrumbCurrent,
  scope,
}: {
  activeLocale: AppLocale;
  breadcrumbCurrent?: string;
  scope: ModelsPageScope;
}) {
  const breadcrumbLabels = getBreadcrumbLabels(activeLocale);
  const { homeUrl, modelsBaseUrl, modelsUrl } = buildCatalogPaths(activeLocale, scope);
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: breadcrumbLabels.home,
      item: homeUrl,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: breadcrumbLabels.models,
      item: modelsBaseUrl,
    },
  ];

  if (scope !== 'all' && breadcrumbCurrent) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: breadcrumbCurrent,
      item: modelsUrl,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };
}

export function buildModelsCatalogItemListJsonLd({
  activeLocale,
  modelCards,
  scope,
}: {
  activeLocale: AppLocale;
  modelCards: ModelsCatalogJsonLdCard[];
  scope: ModelsPageScope;
}) {
  const { modelsBasePath } = buildCatalogPaths(activeLocale, scope);

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: modelCards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: card.label,
      url: `${SITE_BASE_URL}${modelsBasePath}/${card.id}`,
    })),
  };
}

export function buildModelsCatalogFaqJsonLd(faqItems: ModelsCatalogJsonLdFaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
