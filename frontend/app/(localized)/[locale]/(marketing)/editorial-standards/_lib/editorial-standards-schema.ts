import type { EditorialStandardsCopy } from './editorial-standards-copy';

export function buildEditorialStandardsWebPageJsonLd({
  canonicalUrl,
  copy,
  inLanguage,
}: {
  canonicalUrl: string;
  copy: EditorialStandardsCopy;
  inLanguage: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: copy.meta.title,
    description: copy.meta.description,
    url: canonicalUrl,
    inLanguage,
    dateModified: copy.hero.reviewedDate,
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  };
}

export function buildEditorialStandardsBreadcrumbJsonLd({
  canonicalUrl,
  copy,
}: {
  canonicalUrl: string;
  copy: EditorialStandardsCopy;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: copy.hero.eyebrow,
        item: canonicalUrl,
      },
    ],
  };
}
