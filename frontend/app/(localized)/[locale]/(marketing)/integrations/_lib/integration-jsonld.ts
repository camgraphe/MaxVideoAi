import type { IntegrationPageCopy } from './integration-copy';

export function buildIntegrationBreadcrumbJsonLd({
  canonicalUrl,
  copy,
}: {
  canonicalUrl: string;
  copy: IntegrationPageCopy;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: copy.hero.backLabel, item: `https://maxvideoai.com${copy.hero.backHref}` },
      { '@type': 'ListItem', position: 2, name: copy.clientLabel, item: canonicalUrl },
    ],
  } as const;
}
