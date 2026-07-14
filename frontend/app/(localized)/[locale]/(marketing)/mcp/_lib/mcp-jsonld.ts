import { localePathnames, type AppLocale } from '@/i18n/locales';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { SITE_BASE_URL } from '@/lib/metadataUrls';
import type { McpPageCopy } from './mcp-page-types';

type McpSchemaInput = {
  canonicalUrl: string;
  copy: McpPageCopy;
};

export function buildMcpWebApplicationJsonLd({
  canonicalUrl,
  copy,
  inLanguage,
  publication,
}: McpSchemaInput & {
  inLanguage: string;
  publication: McpPublicationState;
}) {
  if (!publication.indexable) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: copy.breadcrumb.current,
    description: copy.meta.description,
    applicationCategory: 'MultimediaApplication',
    inLanguage,
    url: canonicalUrl,
    provider: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
    },
  } as const;
}

export function buildMcpBreadcrumbJsonLd({
  canonicalUrl,
  copy,
  locale,
}: McpSchemaInput & { locale: AppLocale }) {
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: copy.breadcrumb.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: copy.breadcrumb.current,
        item: canonicalUrl,
      },
    ],
  } as const;
}
