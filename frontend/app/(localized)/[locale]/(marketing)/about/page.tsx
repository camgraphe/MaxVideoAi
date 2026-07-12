import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { JsonLd } from '@/components/SeoJsonLd';
import { getEditorialProfile } from '@/lib/editorial/profile';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { AboutView } from './_components/AboutView';
import { getAboutCopy } from './_lib/about-copy';
import { buildAboutBreadcrumbJsonLd, buildAboutWebPageJsonLd } from './_lib/about-schema';

const ABOUT_SLUG_MAP = buildSlugMap('about');

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = getAboutCopy(locale);
  return buildSeoMetadata({
    locale,
    title: copy.meta.title,
    description: copy.meta.description,
    hreflangGroup: 'about',
    slugMap: ABOUT_SLUG_MAP,
    keywords: ['MaxVideoAI', 'AI video models', 'AI video benchmarks', 'AI video editorial methodology'],
    imageAlt: copy.hero.eyebrow,
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const copy = getAboutCopy(locale);
  const profile = getEditorialProfile(locale);
  const canonicalUrl = buildMetadataUrls(locale, ABOUT_SLUG_MAP, { englishPath: '/about' }).canonical;

  return (
    <>
      <JsonLd json={buildAboutWebPageJsonLd({ canonicalUrl, copy, inLanguage: localeRegions[locale] })} />
      <JsonLd json={buildAboutBreadcrumbJsonLd({ canonicalUrl, copy })} />
      <AboutView copy={copy} locale={locale} profile={profile} />
    </>
  );
}
