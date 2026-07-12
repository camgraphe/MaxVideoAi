import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { JsonLd } from '@/components/SeoJsonLd';
import { getEditorialProfile } from '@/lib/editorial/profile';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { EditorialStandardsView } from './_components/EditorialStandardsView';
import { getEditorialStandardsCopy } from './_lib/editorial-standards-copy';
import {
  buildEditorialStandardsBreadcrumbJsonLd,
  buildEditorialStandardsWebPageJsonLd,
} from './_lib/editorial-standards-schema';

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = getEditorialStandardsCopy(locale);
  return buildSeoMetadata({
    locale,
    hreflangGroup: 'editorialStandards',
    title: copy.meta.title,
    description: copy.meta.description,
    keywords: ['MaxVideoAI editorial standards', 'AI video benchmark methodology', 'AI video corrections policy'],
    imageAlt: copy.hero.title,
  });
}

export default async function EditorialStandardsPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const copy = getEditorialStandardsCopy(locale);
  const profile = getEditorialProfile(locale);
  const canonicalUrl = buildMetadataUrls(locale, undefined, { englishPath: '/editorial-standards' }).canonical;

  return (
    <>
      <JsonLd
        json={buildEditorialStandardsWebPageJsonLd({
          canonicalUrl,
          copy,
          inLanguage: localeRegions[locale],
        })}
      />
      <JsonLd json={buildEditorialStandardsBreadcrumbJsonLd({ canonicalUrl, copy })} />
      <EditorialStandardsView copy={copy} locale={locale} profile={profile} />
    </>
  );
}
