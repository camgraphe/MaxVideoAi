import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { PriceEstimator } from '@/components/marketing/PriceEstimator';
import { resolveDictionary } from '@/lib/i18n/server';

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
    canonical: 'https://maxvideoai.com/pricing-calculator',
    languages: {
      en: 'https://maxvideoai.com/pricing-calculator',
      fr: 'https://maxvideoai.com/pricing-calculator?lang=fr',
    },
  },
};

export default function CalculatorPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.calculator;
  const canonical = 'https://maxvideoai.com/pricing-calculator';
  const serviceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'AI Video Generation and Editing',
    name: 'MaxVideoAI',
    description:
      'Generate high-quality AI videos using Sora 2, Veo 3, Pika, and other models. Digital credits, no shipping required.',
    provider: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      url: 'https://maxvideoai.com',
      logo: 'https://maxvideoai.com/icon.png',
    },
    areaServed: 'Worldwide',
    offers: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      price: '10.00',
      availability: 'https://schema.org/InStock',
      url: canonical,
    },
  };
  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>
      <section className="mt-10 rounded-card border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card sm:p-8">
        <h2 className="text-lg font-semibold text-text-primary">How to use this calculator</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>
            Pick the engine you plan to use—Sora, Veo, Pika, or MiniMax. The estimator reflects the same live rates we
            display in the workspace.
          </li>
          <li>
            Adjust duration, resolution, and audio toggles. The <strong>Price Before You Generate</strong> chip updates
            instantly so finance teams can approve spend before a render starts.
          </li>
          <li>
            Export or screenshot the quote for stakeholders, then jump into the full workspace when you are ready to
            launch the job.
          </li>
        </ol>
        <p className="mt-4">
          These estimates capture provider fees plus MaxVideoAI orchestration and refund coverage. If you run multiple
          engines on the same prompt, re-use the calculator with the other model to see the cost difference before you
          launch an A/B.
        </p>
        <p className="mt-4">
          Need deeper forecasting? Connect your wallet and pull the spend report inside{' '}
          <Link href="/pricing" className="font-semibold text-accent hover:text-accentSoft">
            the pricing overview
          </Link>{' '}
          for tiered discounts, or contact us about enterprise credits.
        </p>
      </section>
      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">{content.lite.title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{content.lite.subtitle}</p>
        <div className="mt-6">
          <PriceEstimator variant="lite" />
        </div>
        <p className="mt-4 text-xs text-text-muted">
          {content.lite.footer.split('{link}')[0]}
          <Link href="/pricing" className="font-semibold text-accent hover:text-accentSoft">
            {content.lite.footerLinkText}
          </Link>
          {content.lite.footer.split('{link}')[1] ?? ''}
        </p>
      </section>
      <Script id="calculator-service-jsonld" type="application/ld+json">
        {JSON.stringify(serviceSchema)}
      </Script>
    </div>
  );
}
