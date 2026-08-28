import type { McpPublicationState } from '@/lib/mcp-publication';
import {
  buildSiteOrganizationReference,
  MAXVIDEOAI_PLUGIN_REPOSITORY_URL,
} from '@/lib/seo/site-organization-schema';
import type { IntegrationPageCopy } from './integration-copy';

export function buildIntegrationWebApplicationJsonLd({
  canonicalUrl,
  copy,
  inLanguage,
  publication,
}: {
  canonicalUrl: string;
  copy: IntegrationPageCopy;
  inLanguage: string;
  publication: McpPublicationState;
}) {
  if (!publication.indexable || copy.client === 'chatgpt') return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `MaxVideoAI for ${copy.clientLabel}`,
    description: copy.meta.description,
    applicationCategory: 'MultimediaApplication',
    inLanguage,
    url: canonicalUrl,
    sameAs: MAXVIDEOAI_PLUGIN_REPOSITORY_URL,
    provider: buildSiteOrganizationReference(),
  } as const;
}

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
