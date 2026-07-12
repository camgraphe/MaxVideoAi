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

const PAYG_META: Record<AppLocale, { title: string; description: string; imageAlt: string; keywords: string[] }> = {
  en: {
    title: 'Pay-as-you-go AI Video Generator with Upfront Pricing',
    description: 'Generate AI videos with pay-as-you-go credits instead of a monthly subscription. Compare Seedance 2, Kling, Google Veo, LTX, Wan and other models, see the price before generation, and pay only for completed renders.',
    imageAlt: 'MaxVideoAI price-before-generation workflow.',
    keywords: ['pay-as-you-go AI video generator', 'AI video generator without subscription', 'AI video pricing before generation', 'compare Seedance 2 Kling Google Veo LTX Happy Horse', 'Happy Horse 1.1 price', 'Seedance 2 Mini price'],
  },
  es: {
    title: 'Generador de video con IA de pago por uso y precio por adelantado',
    description: 'Genera videos con IA con créditos de pago por uso, sin suscripción mensual. Compara Seedance 2, Kling, Google Veo, LTX, Wan y otros modelos, revisa el precio antes de generar y paga solo por renders completados.',
    imageAlt: 'Flujo de MaxVideoAI con precio antes de generar.',
    keywords: ['generador de video con IA de pago por uso', 'generador de video IA sin suscripción', 'precio de video con IA antes de generar', 'comparar Seedance 2 Kling Google Veo LTX Happy Horse', 'precio Happy Horse 1.1', 'precio Seedance 2 Mini'],
  },
  fr: {
    title: 'Générateur de vidéos IA sans abonnement, paiement à l’usage',
    description: 'Générez des vidéos IA avec des crédits prépayés et un paiement à l’usage, sans abonnement mensuel. Comparez Seedance 2, Kling, Google Veo, LTX, Wan et d’autres modèles, consultez le prix avant de générer et ne payez que les rendus terminés.',
    imageAlt: 'Flux MaxVideoAI avec prix affiché avant la génération.',
    keywords: ['générateur vidéo IA sans abonnement', 'générateur de vidéos IA paiement à l’usage', 'prix vidéo IA avant génération', 'comparer Seedance 2 Kling Google Veo LTX Happy Horse', 'prix Happy Horse 1.1', 'prix Seedance 2 Mini'],
  },
};

const serializeJsonLd = (data: object) => JSON.stringify(data).replace(/</g, '\\u003c');

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const meta = PAYG_META[locale];

  return buildSeoMetadata({
    locale,
    title: meta.title,
    description: meta.description,
    englishPath: PAYG_PAGE_PATH,
    image: '/og/price-before.png',
    imageAlt: meta.imageAlt,
    keywords: meta.keywords,
  });
}

export default async function PayAsYouGoAiVideoGeneratorPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const { locale } = await props.params;
  const data = buildPayAsYouGoPageData(locale);
  const showcaseVideos = await loadPayAsYouGoVideoShowcase(locale);
  const canonical = buildMetadataUrls(locale, undefined, { englishPath: PAYG_PAGE_PATH }).canonical;
  const breadcrumbJsonLd = buildPayAsYouGoBreadcrumbJsonLd({ canonical, locale });
  const serviceJsonLd = buildPayAsYouGoServiceJsonLd({ canonical, locale });
  const webApplicationJsonLd = buildPayAsYouGoWebApplicationJsonLd({ canonical, locale });

  return (
    <>
      <PayAsYouGoPageView locale={locale} data={data} showcaseVideos={showcaseVideos} />
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
