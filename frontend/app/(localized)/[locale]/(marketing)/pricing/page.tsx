import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FAQSchema } from '@/components/seo/FAQSchema';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { PricingCreditsRefundsSection } from './_components/PricingCreditsRefundsSection';
import { PricingHeroSection } from './_components/PricingHeroSection';
import { PricingJsonLdScripts } from './_components/PricingJsonLdScripts';
import { PricingOtherSurfacesSection } from './_components/PricingOtherSurfacesSection';
import { PricingPopularChecksSection } from './_components/PricingPopularChecksSection';
import { PricingRefundsFaqSection } from './_components/PricingRefundsFaqSection';
import { PricingVideoMatrixSection } from './_components/PricingVideoMatrixSection';
import { buildPricingHubData } from './_lib/pricingHubData';
import { PRICING_SLUG_MAP, buildPricingBreadcrumbJsonLd, buildPricingServiceJsonLd } from './_lib/pricing-jsonld';

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
  const faqEntries = (faq.entries ?? []).slice(0, 12);
  const canonical = buildMetadataUrls(locale, PRICING_SLUG_MAP, { englishPath: '/pricing' }).canonical;
  const breadcrumbJsonLd = buildPricingBreadcrumbJsonLd({ canonical, locale });
  const serviceSchema = buildPricingServiceJsonLd({ canonical, locale });

  return (
    <main className="bg-bg">
      <PricingHeroSection
        badges={content.hero.badges}
        calculatorHref="/app"
        calculatorLabel={content.hero.primaryCta}
        compareHref="#video-pricing"
        compareLabel={content.hero.secondaryCta}
        eyebrow={content.hero.eyebrow}
        subtitle={content.hero.subtitle}
        supportingLine={content.hero.supportingLine}
        title={content.hero.title}
      />

      <div className="container-page max-w-[1440px] py-8 sm:py-10">
        <div className="stack-gap-lg">
          <PricingVideoMatrixSection video={pricingHub.video} locale={locale} />
          <PricingPopularChecksSection checks={pricingHub.popularChecks} locale={locale} />
          <PricingOtherSurfacesSection data={pricingHub.otherSurfaces} locale={locale} />
          <PricingCreditsRefundsSection locale={locale} />
          <PricingRefundsFaqSection faq={faq} faqEntries={faqEntries} />
        </div>
      </div>

      <PricingJsonLdScripts breadcrumbJsonLd={breadcrumbJsonLd} serviceSchema={serviceSchema} />
      <FAQSchema questions={faqEntries.slice(0, 6)} />
    </main>
  );
}
