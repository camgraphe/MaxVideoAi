import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { CompanyTrustView } from './_components/CompanyTrustView';
import { getCompanyCopy } from './_lib/company-copy';

const COMPANY_SLUG_MAP = buildSlugMap('company');

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = getCompanyCopy(locale);
  return buildSeoMetadata({
    locale,
    title: copy.meta.title,
    description: copy.meta.description,
    hreflangGroup: 'company',
    slugMap: COMPANY_SLUG_MAP,
    imageAlt: copy.hero.eyebrow,
  });
}

export default async function CompanyPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  return <CompanyTrustView copy={getCompanyCopy(locale)} locale={locale} />;
}
