import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import { getMcpPublicationState } from '@/lib/mcp-publication';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getMcpCompatibilityEvidence } from '../../mcp/_lib/mcp-compatibility';
import { IntegrationJsonLdScripts } from '../_components/IntegrationJsonLdScripts';
import { IntegrationPageView } from '../_components/IntegrationPageView';
import { getIntegrationCopy } from '../_lib/integration-copy';
import { buildIntegrationBreadcrumbJsonLd, buildIntegrationWebApplicationJsonLd } from '../_lib/integration-jsonld';

export const revalidate = 3600;

function publicationState() {
  return getMcpPublicationState(FEATURES.mcp);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = getIntegrationCopy(locale, 'chatgpt');
  const publication = publicationState();
  return buildSeoMetadata({
    locale,
    title: copy.meta.title,
    description: copy.meta.description,
    englishPath: '/integrations/chatgpt',
    imageAlt: copy.hero.title,
    robots: { index: publication.indexable, follow: publication.renderPublicPage },
  });
}

export default async function ChatGptIntegrationPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const publication = publicationState();
  if (!publication.renderPublicPage) notFound();
  const copy = getIntegrationCopy(locale, 'chatgpt');
  const compatibility = getMcpCompatibilityEvidence().clients.chatgpt;
  const canonicalUrl = buildMetadataUrls(locale, undefined, { englishPath: '/integrations/chatgpt' }).canonical;
  const application = buildIntegrationWebApplicationJsonLd({
    canonicalUrl,
    copy,
    inLanguage: localeRegions[locale],
    publication,
  });
  const breadcrumb = buildIntegrationBreadcrumbJsonLd({ canonicalUrl, copy });
  return (
    <>
      <IntegrationPageView compatibility={compatibility} copy={copy} locale={locale} publication={publication} />
      <IntegrationJsonLdScripts application={application} breadcrumb={breadcrumb} />
    </>
  );
}
