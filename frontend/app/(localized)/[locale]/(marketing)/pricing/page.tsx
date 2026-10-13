import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FAQSchema } from '@/components/seo/FAQSchema';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { PricingCurrentQuickStart, PricingCurrentSections } from './_components/PricingCurrentContent';
import { PricingPendingQuickStart, PricingPendingSections } from './_components/PricingPendingContent';
import { PricingHeroSection } from './_components/PricingHeroSection';
import { PricingJsonLdScripts } from './_components/PricingJsonLdScripts';
import { buildCurrentPricingHubData } from './_lib/currentPricingHubData';
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
    image: '/og/pricing-2026-09-25.png',
    imageAlt: 'MaxVideoAI pricing: see the price before creating.',
  });
}

export default async function PricingPage(props: { params: Promise<{ locale: AppLocale }> }) {
  const params = await props.params;
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.pricing;
  const pricingHub = buildCurrentPricingHubData(locale);
  // Observe an early rejection without converting it into a successful pricing fallback.
  void pricingHub.catch(() => undefined);
  const faq = content.faq;
  const faqEntries = (faq.entries ?? []).slice(0, 12);
  const canonical = buildMetadataUrls(locale, PRICING_SLUG_MAP, { englishPath: '/pricing' }).canonical;
  const breadcrumbJsonLd = buildPricingBreadcrumbJsonLd({ canonical, locale });
  const serviceSchema = buildPricingServiceJsonLd({ canonical, locale });

  return (
    <div className="bg-bg">
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
      >
        <Suspense fallback={<PricingPendingQuickStart locale={locale} title={content.hero.quickStartTitle} note={content.hero.quickStartNote} />}>
          <PricingCurrentQuickStart pricingHub={pricingHub} title={content.hero.quickStartTitle} note={content.hero.quickStartNote} />
        </Suspense>
      </PricingHeroSection>

      <div className="container-page max-w-[1440px] py-8 sm:py-10">
        <div className="stack-gap-lg">
          <Suspense fallback={<PricingPendingSections locale={locale} />}>
            <PricingCurrentSections pricingHub={pricingHub} locale={locale} faq={faq} faqEntries={faqEntries} />
          </Suspense>
        </div>
      </div>

      <PricingJsonLdScripts breadcrumbJsonLd={breadcrumbJsonLd} serviceSchema={serviceSchema} />
      <FAQSchema questions={faqEntries.slice(0, 6)} />
    </div>
  );
}
