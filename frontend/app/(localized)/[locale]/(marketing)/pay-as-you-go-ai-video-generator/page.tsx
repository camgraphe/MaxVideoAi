import type { Metadata } from 'next';
import type { AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { PayAsYouGoPageView } from './_components/PayAsYouGoPageView';
import { PAYG_PAGE_PATH, buildPayAsYouGoPageData } from './_lib/payg-page-data';
import {
  buildPayAsYouGoBreadcrumbJsonLd,
  buildPayAsYouGoServiceJsonLd,
  buildPayAsYouGoWebApplicationJsonLd,
} from './_lib/payg-jsonld';
import { loadPayAsYouGoVideoShowcase } from './_lib/payg-video-showcase';

export const revalidate = 600;

const title = 'Pay-as-you-go AI Video Generator with Upfront Pricing';
const description =
  'Generate AI videos with pay-as-you-go credits instead of a monthly subscription. Compare Seedance 2, Kling, Google Veo, LTX, Wan and other models, see the price before generation, and pay only for completed renders.';

const serializeJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await props.params;

  return buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: PAYG_PAGE_PATH,
    image: '/og/price-before.png',
    imageAlt: 'MaxVideoAI price-before-generation workflow.',
    keywords: [
      'pay-as-you-go AI video generator',
      'AI video generator without subscription',
      'AI video pricing before generation',
      'compare Seedance 2 Kling Google Veo LTX Happy Horse',
      'Happy Horse 1.1 price',
      'Seedance 2 Mini price',
    ],
  });
}

export default async function PayAsYouGoAiVideoGeneratorPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await props.params;
  const data = buildPayAsYouGoPageData(locale);
  const showcaseVideos = await loadPayAsYouGoVideoShowcase();
  const canonical = buildMetadataUrls(locale, undefined, { englishPath: PAYG_PAGE_PATH }).canonical;
  const breadcrumbJsonLd = buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale });
  const serviceJsonLd = buildPayAsYouGoServiceJsonLd({ canonical });
  const webApplicationJsonLd = buildPayAsYouGoWebApplicationJsonLd({ canonical });

  return (
    <>
      <PayAsYouGoPageView data={data} showcaseVideos={showcaseVideos} />
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
