import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { localeRegions } from '@/i18n/locales';
import { JsonLd } from '@/components/SeoJsonLd';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { loadBenchmarkLabStaticData } from '@/server/benchmark-lab-data';
import { fetchPublicBenchmarkLatency } from '@/server/benchmark-lab-metrics';
import { BenchmarkLabView } from './_components/BenchmarkLabView';
import { getBenchmarkCopy } from './_lib/benchmark-copy';
import { buildBenchmarkPageData } from './_lib/benchmark-page-data';
import { buildBenchmarkBreadcrumbJsonLd, buildBenchmarkWebPageJsonLd } from './_lib/benchmark-schema';

export const revalidate = 21600;

export async function generateMetadata({ params }: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await params;
  const copy = getBenchmarkCopy(locale);
  return buildSeoMetadata({
    locale,
    englishPath: '/benchmarks',
    title: copy.meta.title,
    description: copy.meta.description,
    titleBranding: 'none',
    keywords: ['AI video benchmarks', 'AI video model scores', 'AI video generation speed', 'MaxVideoAI methodology'],
    imageAlt: copy.hero.title,
  });
}

export default async function BenchmarkLabPage({ params }: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await params;
  const copy = getBenchmarkCopy(locale);
  const [staticData, latency] = await Promise.all([loadBenchmarkLabStaticData(), fetchPublicBenchmarkLatency()]);
  const data = buildBenchmarkPageData(staticData, latency);
  const canonicalUrl = buildMetadataUrls(locale, undefined, { englishPath: '/benchmarks' }).canonical;
  return (
    <>
      <JsonLd json={buildBenchmarkWebPageJsonLd({ canonicalUrl, copy, inLanguage: localeRegions[locale], modifiedAt: data.methodology.effectiveDate })} />
      <JsonLd json={buildBenchmarkBreadcrumbJsonLd({ canonicalUrl, copy })} />
      <BenchmarkLabView copy={copy} data={data} locale={locale} />
    </>
  );
}
