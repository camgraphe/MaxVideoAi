import type { Metadata } from 'next';

import { localeRegions, type AppLocale } from '@/i18n/locales';
import { getMcpIntegration } from '@/lib/mcp-integration-registry';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import type { McpPublicationState } from '@/lib/mcp-publication';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import {
  getMcpCompatibilityClientEvidence,
  type McpCompatibilityClientEvidence,
} from '../../mcp/_lib/mcp-compatibility';
import { getMcpHostProof, type McpHostProof } from '../../mcp/_lib/mcp-host-proof';
import type { McpClientId } from '../../mcp/_lib/mcp-page-types';
import { getIntegrationCopy, type IntegrationPageCopy } from './integration-copy';
import {
  buildIntegrationBreadcrumbJsonLd,
  buildIntegrationWebApplicationJsonLd,
} from './integration-jsonld';

export type BuildIntegrationArgs = {
  client: McpClientId;
  locale: AppLocale;
  publication: McpPublicationState;
};

export function buildIntegrationMetadata({
  client,
  locale,
  publication,
}: BuildIntegrationArgs): Metadata {
  const copy = getIntegrationCopy(locale, client);
  return buildSeoMetadata({
    locale,
    title: copy.meta.title,
    description: copy.meta.description,
    englishPath: getMcpIntegration(client).englishPath,
    imageAlt: copy.hero.title,
    robots: { index: publication.indexable, follow: publication.renderPublicPage },
  });
}

export function buildIntegrationPageData({
  client,
  locale,
  publication,
}: BuildIntegrationArgs): {
  application: ReturnType<typeof buildIntegrationWebApplicationJsonLd>;
  breadcrumb: ReturnType<typeof buildIntegrationBreadcrumbJsonLd>;
  canonicalUrl: string;
  compatibility: McpCompatibilityClientEvidence;
  copy: IntegrationPageCopy;
  hostProof: McpHostProof | null;
} {
  const integration = getMcpIntegration(client);
  const copy = getIntegrationCopy(locale, client);
  const compatibility = getMcpCompatibilityClientEvidence(client);
  for (const guide of copy.setup.hostGuides) {
    if (!copy.compatibility.statuses[guide.hostId]?.trim()) {
      throw new Error(`Missing compatibility status for ${client}/${locale}/${guide.hostId}`);
    }
  }
  const canonicalUrl = buildMetadataUrls(locale, undefined, {
    englishPath: integration.englishPath,
  }).canonical;
  const application = buildIntegrationWebApplicationJsonLd({
    canonicalUrl,
    copy,
    inLanguage: localeRegions[locale],
    publication,
  });
  return {
    application,
    breadcrumb: buildIntegrationBreadcrumbJsonLd({ canonicalUrl, copy }),
    canonicalUrl,
    compatibility,
    copy,
    hostProof: getMcpHostProof(client, locale),
  };
}
