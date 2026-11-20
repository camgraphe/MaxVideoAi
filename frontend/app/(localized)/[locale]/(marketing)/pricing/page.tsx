import { Suspense } from 'react';
import NextLink from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FAQSchema } from '@/components/seo/FAQSchema';
import type { AppLocale } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { PricingCurrentQuickStart, PricingCurrentSections } from './_components/PricingCurrentContent';
import { PricingPendingQuickStart, PricingPendingSections } from './_components/PricingPendingContent';
import { PricingAnchorRestore } from './_components/PricingAnchorRestore.client';
import { pricingOpeningCopy } from './_lib/pricing-opening-copy';
import { PricingHeroSection } from './_components/PricingHeroSection';
import { PricingJsonLdScripts } from './_components/PricingJsonLdScripts';
import { readPricingOpening } from './_lib/pricing-opening';
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
  const { pricingHub, rows, quotedOn } = await readPricingOpening(locale);
  // Observe an early rejection without converting it into a successful pricing fallback.
  void pricingHub.catch(() => undefined);
  const faq = content.faq;
  const faqEntries = (faq.entries ?? []).slice(0, 12);
  const canonical = buildMetadataUrls(locale, PRICING_SLUG_MAP, { englishPath: '/pricing' }).canonical;
  const breadcrumbJsonLd = buildPricingBreadcrumbJsonLd({ canonical, locale });
  const serviceSchema = buildPricingServiceJsonLd({ canonical, locale });

  return (
    <div className="bg-bg">
      <PricingAnchorRestore />
      <PricingHeroSection
        locale={locale}
        hero={content.hero}
        rows={rows}
        canonical={canonical}
        quotedOn={quotedOn}
      />

      <div className="container-page max-w-[1440px] py-8 sm:py-10">
        <div className="stack-gap-lg">
          <Suspense fallback={<PricingPendingSections locale={locale} />}>
            <PricingCurrentSections pricingHub={pricingHub} locale={locale} quotedOn={quotedOn} faq={faq} faqEntries={faqEntries} />
          </Suspense>
          <details id="pricing-minute-budget" className="mx-auto w-full max-w-[1124px] border-t border-hairline py-4">
            <summary className="cursor-pointer font-semibold">{pricingOpeningCopy[locale].budget}</summary>
            <Suspense fallback={<PricingPendingQuickStart locale={locale} title={content.hero.quickStartTitle} note={content.hero.quickStartNote} />}>
              <PricingCurrentQuickStart pricingHub={pricingHub} title={content.hero.quickStartTitle} note={content.hero.quickStartNote} />
            </Suspense>
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <a href="#full-video-pricing-table">{pricingOpeningCopy[locale].catalogue}</a>
              <NextLink prefetch={false} href="/video/kling-3-standard-rainy-neon-street-multi-shot-example-99e0f0fa">{pricingOpeningCopy[locale].oldClip} ↗</NextLink>
              {content.hero.badges.map((badge, i) => i === content.hero.badges.length - 1
                ? <NextLink key={badge} prefetch={false} href="/return-policy">{badge}</NextLink> : <span key={badge}>{badge}</span>)}
            </div>
          </details>
        </div>
      </div>

      <PricingJsonLdScripts breadcrumbJsonLd={breadcrumbJsonLd} serviceSchema={serviceSchema} />
      <FAQSchema questions={faqEntries.slice(0, 6)} />
    </div>
  );
}
