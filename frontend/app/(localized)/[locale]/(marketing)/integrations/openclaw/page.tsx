import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import type { AppLocale } from '@/i18n/locales';
import { getMcpIntegrationPublicationState, getMcpPublicationState } from '@/lib/mcp-publication';
import { IntegrationJsonLdScripts } from '../_components/IntegrationJsonLdScripts';
import { IntegrationPageView } from '../_components/IntegrationPageView';
import { buildIntegrationMetadata, buildIntegrationPageData } from '../_lib/integration-page-data';

export const revalidate = 3600;
const CLIENT = 'openclaw' as const;
type PageProps = { params: Promise<{ locale: AppLocale }> };

function publicationState() {
  return getMcpIntegrationPublicationState(CLIENT, getMcpPublicationState(FEATURES.mcp));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildIntegrationMetadata({ client: CLIENT, locale, publication: publicationState() });
}

export default async function OpenClawIntegrationPage({ params }: PageProps) {
  const { locale } = await params;
  const publication = publicationState();
  if (!publication.renderPublicPage) notFound();
  const data = buildIntegrationPageData({ client: CLIENT, locale, publication });
  return <><IntegrationPageView compatibility={data.compatibility} copy={data.copy} hostProof={data.hostProof} locale={locale} publication={publication} /><IntegrationJsonLdScripts application={data.application} breadcrumb={data.breadcrumb} /></>;
}
