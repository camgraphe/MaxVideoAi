import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES } from '@/content/feature-flags';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import { getMcpPublicationState } from '@/lib/mcp-publication';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { McpJsonLdScripts } from './_components/McpJsonLdScripts';
import { McpPageView } from './_components/McpPageView';
import { buildMcpBudgetOptions } from './_lib/mcp-budget-options';
import { getMcpCompatibilityEvidence } from './_lib/mcp-compatibility';
import { buildMcpBreadcrumbJsonLd, buildMcpWebApplicationJsonLd } from './_lib/mcp-jsonld';
import { getMcpHostProof } from './_lib/mcp-host-proof';
import { getMcpPageCopy } from './_lib/mcp-page-copy';
import { getMcpProof } from './_lib/mcp-proof';

export const revalidate = 3600;

function publicationState() {
  return getMcpPublicationState(FEATURES.mcp);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const copy = getMcpPageCopy(locale);
  const publication = publicationState();
  return buildSeoMetadata({
    locale,
    title: copy.meta.title,
    description: copy.meta.description,
    englishPath: '/mcp',
    imageAlt: copy.hero.title,
    robots: {
      index: publication.indexable,
      follow: publication.renderPublicPage,
    },
  });
}

export default async function McpPage({
  params,
}: {
  params: Promise<{ locale: AppLocale }>;
}) {
  const { locale } = await params;
  const publication = publicationState();
  if (!publication.renderPublicPage) notFound();

  const copy = getMcpPageCopy(locale);
  const [proof] = await Promise.all([getMcpProof(locale)]);
  const hostProof = getMcpHostProof('claude', locale);
  const budgetOptions = buildMcpBudgetOptions(locale, publication);
  const compatibility = getMcpCompatibilityEvidence();
  const canonicalUrl = buildMetadataUrls(locale, undefined, { englishPath: '/mcp' }).canonical;
  const application = buildMcpWebApplicationJsonLd({
    canonicalUrl,
    copy,
    inLanguage: localeRegions[locale],
    publication,
  });
  const breadcrumb = buildMcpBreadcrumbJsonLd({ canonicalUrl, copy, locale });

  return (
    <>
      <McpPageView
        budgetOptions={budgetOptions}
        compatibility={compatibility}
        copy={copy}
        locale={locale}
        proof={proof}
        hostProof={hostProof}
        publication={publication}
      />
      <McpJsonLdScripts application={application} breadcrumb={breadcrumb} />
    </>
  );
}
