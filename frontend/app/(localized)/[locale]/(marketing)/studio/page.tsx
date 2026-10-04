import type { Metadata } from 'next';
import { normalizeAppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { serializeJsonLd } from '@/lib/seo/jsonld';
import { StudioMarketingPage } from './_components/StudioMarketingPage';
import { getStudioMarketingCopy } from './_lib/studio-marketing-copy';
import { buildStudioMarketingSchema } from './_lib/studio-marketing-schema';

export const revalidate = 3600;
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = normalizeAppLocale((await params).locale);
  const copy = getStudioMarketingCopy(locale);
  return buildSeoMetadata({ locale, ...copy.meta, englishPath: '/studio' });
}

export default async function StudioPage({ params }: Props) {
  const locale = normalizeAppLocale((await params).locale);
  const copy = getStudioMarketingCopy(locale);
  return <>
    <StudioMarketingPage copy={copy} locale={locale} />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildStudioMarketingSchema(locale, copy)) }} />
  </>;
}
