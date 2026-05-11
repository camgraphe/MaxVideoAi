import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { buildMarketingServiceJsonLd } from '@/lib/seo/marketingServiceJsonLd';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { PricingCreditsRefundsSection } from './_components/PricingCreditsRefundsSection';
import { PricingHeroSection } from './_components/PricingHeroSection';
import { PricingJsonLdScripts } from './_components/PricingJsonLdScripts';
import { PricingOtherSurfacesSection } from './_components/PricingOtherSurfacesSection';
import { PricingPopularChecksSection } from './_components/PricingPopularChecksSection';
import { PricingRefundsFaqSection } from './_components/PricingRefundsFaqSection';
import { PricingVideoMatrixSection } from './_components/PricingVideoMatrixSection';
import { buildPricingHubData } from './_lib/pricingHubData';

const PRICING_SLUG_MAP = buildSlugMap('pricing');

export const revalidate = 600;

export async function generateMetadata(props: { params: Promise<{ locale: AppLocale }> }): Promise<Metadata> {
  const params = await props.params;
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'pricing.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'pricing',
    slugMap: PRICING_SLUG_MAP,
    image: '/og/pricing-hub.png',
    imageAlt: 'MaxVideoAI pricing comparison tables.',
  });
}

export default async function PricingPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.pricing;
  const pricingHub = buildPricingHubData(locale);
  const faq = content.faq;
  const faqEntries = (faq.entries ?? []).slice(0, 11);
  const canonical = buildMetadataUrls(locale, PRICING_SLUG_MAP, { englishPath: '/pricing' }).canonical;
  const breadcrumbLabels = getBreadcrumbLabels(locale);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: breadcrumbLabels.home,
        item: homeUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: breadcrumbLabels.pricing,
        item: canonical,
      },
    ],
  };
  const serviceSchema = buildMarketingServiceJsonLd({
    name:
      locale === 'fr' ? 'Tarifs MaxVideoAI' : locale === 'es' ? 'Precios de MaxVideoAI' : 'MaxVideoAI pricing',
    description:
      locale === 'fr'
        ? 'Comparez les prix MaxVideoAI par moteur, durée, résolution, audio, image et outils.'
        : locale === 'es'
          ? 'Compara precios de MaxVideoAI por motor, duración, resolución, audio, imagen y herramientas.'
          : 'Compare MaxVideoAI prices by engine, duration, resolution, audio, image and tools.',
    serviceType:
      locale === 'fr'
        ? 'Comparaison de prix IA'
        : locale === 'es'
          ? 'Comparación de precios de IA'
          : 'AI pricing comparison',
    category: locale === 'fr' ? 'Tarification' : locale === 'es' ? 'Precios' : 'Pricing',
    url: canonical,
    offers: {
      priceCurrency: 'USD',
      price: '10.00',
      availability: 'https://schema.org/InStock',
      url: canonical,
    },
  });

  return (
    <main className="bg-bg">
      <PricingHeroSection
        badges={content.hero.badges}
        calculatorHref="/app"
        calculatorLabel={content.hero.primaryCta}
        compareHref="#video-pricing"
        compareLabel={content.hero.secondaryCta}
        subtitle={content.hero.subtitle}
        supportingLine={content.hero.supportingLine}
        title={content.hero.title}
      />

      <div className="container-page max-w-[1280px] py-8 sm:py-10">
        <div className="stack-gap-lg">
          <PricingVideoMatrixSection video={pricingHub.video} />
          <PricingPopularChecksSection checks={pricingHub.popularChecks} />
          <PricingOtherSurfacesSection data={pricingHub.otherSurfaces} />
          <PricingCreditsRefundsSection />
          <PricingRefundsFaqSection faq={faq} faqEntries={faqEntries} />
        </div>
      </div>

      <PricingJsonLdScripts breadcrumbJsonLd={breadcrumbJsonLd} serviceSchema={serviceSchema} />
      <FAQSchema questions={faqEntries.slice(0, 6)} />
    </main>
  );
}
