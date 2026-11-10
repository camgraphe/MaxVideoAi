import type { Metadata } from 'next';
import { normalizeAppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getLocalizedUrl } from '@/lib/metadataUrls';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { getComparisonCopy } from './_content';
import { ComparisonPageView } from './_components/ComparisonPageView';
import { buildComparisonSchema } from './_lib/schema';
import { COMPARISON_PATH } from './_lib/evidence';

export const revalidate = 86400;
type Params = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const locale = normalizeAppLocale((await params).locale);
  const copy = getComparisonCopy(locale);
  return buildSeoMetadata({ locale, ...copy.meta, englishPath: COMPARISON_PATH,
    image: `/higgsfield-alternative/comparison?format=og&locale=${locale}`, imageDimensions: { width: 1200, height: 630 },
    imageAlt: copy.matrix.caption,
  });
}
export default async function HiggsfieldAlternativePage({ params }: Params) {
  const locale = normalizeAppLocale((await params).locale);
  const copy = getComparisonCopy(locale);
  const canonical = getLocalizedUrl(locale, COMPARISON_PATH);
  return <><ComparisonPageView copy={copy} locale={locale} canonical={canonical} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildComparisonSchema(copy, locale, canonical)) }} /></>;
}
