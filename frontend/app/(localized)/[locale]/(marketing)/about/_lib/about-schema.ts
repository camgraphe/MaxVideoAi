import type { AboutCopy } from './about-copy';

export function buildAboutWebPageJsonLd({
  canonicalUrl,
  copy,
  inLanguage,
}: {
  canonicalUrl: string;
  copy: AboutCopy;
  inLanguage: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: copy.meta.title,
    description: copy.meta.description,
    url: canonicalUrl,
    inLanguage,
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  };
}

export function buildAboutBreadcrumbJsonLd({ canonicalUrl, copy }: { canonicalUrl: string; copy: AboutCopy }) {
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
