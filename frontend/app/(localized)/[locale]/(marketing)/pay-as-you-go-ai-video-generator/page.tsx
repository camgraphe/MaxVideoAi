import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { PayAsYouGoStreamingView } from './_components/PayAsYouGoStreamingView';
import { getPayAsYouGoContent } from './_content';
import { PAYG_PAGE_PATH, buildPayAsYouGoHeroData, buildPayAsYouGoPageData } from './_lib/payg-page-data';
import { observePayAsYouGoRead } from './_lib/payg-read-result';
import {
  buildPayAsYouGoBreadcrumbJsonLd,
  buildPayAsYouGoServiceJsonLd,
  buildPayAsYouGoWebApplicationJsonLd,
} from './_lib/payg-jsonld';
import { buildCurrentVideoPricingData } from '../pricing/_lib/currentPricingHubData';
import { loadPayAsYouGoVideoShowcase } from './_lib/payg-video-showcase';

export const revalidate = 600;

const serializeJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const meta = getPayAsYouGoContent(locale).metadata;

  return buildSeoMetadata({
    locale,
    title: meta.title,
    description: meta.description,
    englishPath: PAYG_PAGE_PATH,
    image: '/og/home-2026-09-25.png',
    imageAlt: meta.imageAlt,
    keywords: meta.keywords,
  });
}

export default async function PayAsYouGoAiVideoGeneratorPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await props.params;
  const content = getPayAsYouGoContent(locale);
  const data = observePayAsYouGoRead(buildCurrentVideoPricingData(locale)
    .then(pricingHub => buildPayAsYouGoPageData({ locale, content, pricingHub })));
  const showcaseVideos = observePayAsYouGoRead(
    loadPayAsYouGoVideoShowcase({ locale, copy: content.showcase.runtime }),
  );
  const canonical = buildMetadataUrls(locale, undefined, { englishPath: PAYG_PAGE_PATH }).canonical;
  const breadcrumbJsonLd = buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale, copy: content.jsonLd });
  const serviceJsonLd = buildPayAsYouGoServiceJsonLd({ canonical, copy: content.jsonLd });
  const webApplicationJsonLd = buildPayAsYouGoWebApplicationJsonLd({ canonical, copy: content.jsonLd });

  return (
    <>
      <PayAsYouGoStreamingView
        data={data}
        hero={buildPayAsYouGoHeroData(content)}
        showcaseCopy={content.showcase.section}
        showcaseVideos={showcaseVideos}
      />
      <script
        id="payg-breadcrumb-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
      />
      <script
        id="payg-service-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(serviceJsonLd) }}
      />
      <script
        id="payg-web-application-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webApplicationJsonLd) }}
      />
    </>
  );
}
