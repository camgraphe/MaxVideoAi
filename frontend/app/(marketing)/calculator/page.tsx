import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { PriceEstimator } from '@/components/marketing/PriceEstimator';
import { resolveDictionary } from '@/lib/i18n/server';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { DEFAULT_MARKETING_SCENARIO } from '@/lib/pricing-scenarios';

export const metadata: Metadata = {
  title: 'AI Video Price Calculator — MaxVideo AI',
  description: 'Estimate AI video costs by engine, duration, and resolution before you generate.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'AI Video Price Calculator — MaxVideo AI',
    description: 'Public calculator to preview AI video pricing and route into the full MaxVideo AI workspace.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Price calculator preview.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/calculator',
    languages: {
      en: 'https://www.maxvideo.ai/calculator',
      fr: 'https://www.maxvideo.ai/calculator?lang=fr',
    },
  },
};

export default function CalculatorPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.calculator;
  const kernel = getPricingKernel();
  const starterQuote = kernel.quote(DEFAULT_MARKETING_SCENARIO);
  const starterPrice = (starterQuote.snapshot.totalCents / 100).toFixed(2);
  const starterCurrency = starterQuote.snapshot.currency;
  const unitRate = starterQuote.snapshot.base.rate;
  const canonical = 'https://www.maxvideo.ai/calculator';
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'MaxVideoAI Starter Credits',
    description: content.hero.subtitle,
    brand: {
      '@type': 'Brand',
      name: 'MaxVideoAI',
    },
    url: canonical,
    offers: {
      '@type': 'Offer',
      price: starterPrice,
      priceCurrency: starterCurrency,
      url: canonical,
      category: 'Starter credits',
      eligibleCustomerType: 'https://schema.org/BusinessCustomer',
      availability: 'https://schema.org/InStock',
      priceValidUntil: '2025-12-31',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: unitRate,
        priceCurrency: starterCurrency,
        unitCode: 'SEC',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'SEC',
        },
      },
    },
  };
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">{content.lite.title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{content.lite.subtitle}</p>
        <div className="mt-6">
          <PriceEstimator showWalletActions={false} variant="lite" />
        </div>
        <p className="mt-4 text-xs text-text-muted">
          {content.lite.footer.split('{link}')[0]}
          <Link href="/pricing" className="font-semibold text-accent hover:text-accentSoft">
            {content.lite.footerLinkText}
          </Link>
          {content.lite.footer.split('{link}')[1] ?? ''}
        </p>
      </section>
      <Script id="calculator-product-jsonld" type="application/ld+json">
        {JSON.stringify(productSchema)}
      </Script>
    </div>
  );
}
