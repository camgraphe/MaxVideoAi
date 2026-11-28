import { notFound } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import type { AppLocale } from '@/i18n/locales';
import { getMcpDirectoryGuide } from '@/lib/mcp-integration-registry';
import { getMcpPublicationState } from '@/lib/mcp-publication';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { IntegrationJsonLdScripts } from '../_components/IntegrationJsonLdScripts';
import { GlamaDirectoryGuide } from '../_components/GlamaDirectoryGuide';
import { glamaText } from '../_content/glama';
import { guideLabels } from '../_content/guide-presentation';

export const revalidate = 3600;
type PageProps = {params: Promise<{locale: AppLocale}>};
const guide = getMcpDirectoryGuide('glama');

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  const publication = getMcpPublicationState(FEATURES.mcp);
  return buildSeoMetadata({ locale, title: glamaText[locale].title, description: glamaText[locale].intro, englishPath: guide.englishPath,
    robots: { index: publication.indexable && guide.site.publication === 'live' && guide.site.indexable, follow: publication.renderPublicPage && guide.site.publication !== 'hidden' } });
}
export default async function GlamaIntegrationPage({ params }: PageProps) {
  const { locale } = await params;
  const publication = getMcpPublicationState(FEATURES.mcp);
  if (!publication.renderPublicPage || guide.site.publication === 'hidden') notFound();
  const breadcrumb = { '@context':'https://schema.org','@type':'BreadcrumbList',itemListElement: [
    { '@type':'ListItem', position:1, name:guideLabels[locale].hub, item: buildMetadataUrls(locale, undefined, {englishPath: '/mcp'}).canonical },
    { '@type':'ListItem', position:2, name:guide.label, item: buildMetadataUrls(locale, undefined, {englishPath: guide.englishPath}).canonical },
  ]};
  return <><GlamaDirectoryGuide locale={locale} connectionAvailable={publication.connectionAvailable}/><IntegrationJsonLdScripts application={null} breadcrumb={breadcrumb}/></>;
}
