import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { SITE_ORIGIN } from '@/lib/siteOrigin';
import { DocsIndexView } from './_components/DocsIndexView';
import { getDocsEntries } from './_lib/docs-index-data';

const SITE = SITE_ORIGIN.replace(/\/$/, '');
const DOCS_SLUG_MAP = buildSlugMap('docs');

export const revalidate = 600;

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const metaCopy = dictionary.docs?.meta ?? {};
  const title = metaCopy.title ?? 'Docs — Onboarding, Brand Safety, Refunds & API Webhooks';
  const description =
    metaCopy.description ??
    'Start here for onboarding, price system and refunds. Learn about brand-safe filters and see webhook/API references. Deeper guides live in the authenticated workspace.';
  const ogImage = `${SITE}/og/price-before.png`;

  return buildSeoMetadata({
    locale,
    title: `${title} — MaxVideoAI`,
    description,
    hreflangGroup: 'docs',
    slugMap: DOCS_SLUG_MAP,
    image: ogImage,
    imageAlt: 'Docs — MaxVideoAI',
    robots: {
      index: true,
      follow: true,
    },
  });
}

export default async function DocsIndexPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const metadataUrls = buildMetadataUrls(locale, DOCS_SLUG_MAP, { englishPath: '/docs' });
  const docs = await getDocsEntries(locale);

  return <DocsIndexView content={dictionary.docs} docs={docs} metadataUrls={metadataUrls} site={SITE} />;
}
