import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { PriceEstimator } from '@/components/marketing/PriceEstimator';
import { resolveDictionary } from '@/lib/i18n/server';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { DEFAULT_MARKETING_SCENARIO, scenarioToPricingInput } from '@/lib/pricing-scenarios';

export const metadata: Metadata = {
  title: 'Pricing — MaxVideo AI',
  description: 'Transparent, pay-as-you-go pricing. Price before you generate and only pay for successful renders.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'Pricing — MaxVideo AI',
    description: 'Estimate costs by engine, duration, and resolution. Wallets, credits, and member savings included.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'Pricing estimator interface.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/pricing',
    languages: {
      en: 'https://www.maxvideo.ai/pricing',
      fr: 'https://www.maxvideo.ai/pricing?lang=fr',
    },
  },
};

export default function PricingPage() {
  const { dictionary } = resolveDictionary();
  const content = dictionary.pricing;
  const wallet = content.wallet;
  const teams = content.teams;
  const member = content.member;
  const refunds = content.refunds;
  const faq = content.faq;
  const canonical = 'https://www.maxvideo.ai/pricing';
  const kernel = getPricingKernel();
  const starterQuote = kernel.quote(scenarioToPricingInput(DEFAULT_MARKETING_SCENARIO));
  const starterPrice = (starterQuote.snapshot.totalCents / 100).toFixed(2);
  const starterCurrency = starterQuote.snapshot.currency;
  const unitRate = starterQuote.snapshot.base.rate;

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

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.entries.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
      </header>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-text-primary">{content.estimator.title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{content.estimator.subtitle}</p>
          <div className="mt-6">
            <PriceEstimator />
          </div>
          <p className="mt-6 text-xs text-text-muted">
            {content.estimator.walletLink}{' '}
            <Link href="/calculator" className="font-semibold text-accent hover:text-accentSoft">
              {content.estimator.walletLinkCta}
            </Link>
            .
          </p>
        </article>

        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-text-primary">{wallet.title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{wallet.description}</p>
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {wallet.points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">{teams.title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{teams.description}</p>
        <ul className="mt-4 space-y-3 text-sm text-text-secondary">
          {teams.points.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">{member.title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{member.subtitle}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {member.tiers.map((tier) => (
            <div key={tier.name} className="rounded-card border border-hairline bg-bg p-4">
              <p className="text-sm font-semibold text-text-primary">{tier.name}</p>
              <p className="mt-1 text-xs uppercase tracking-micro text-text-muted">{tier.requirement}</p>
              <p className="mt-3 text-sm text-text-secondary">{tier.benefit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-text-primary">{refunds.title}</h2>
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {refunds.points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
          <h2 className="text-xl font-semibold text-text-primary">{faq.title}</h2>
          <dl className="mt-4 space-y-4">
            {faq.entries.map((entry) => (
              <div key={entry.question}>
                <dt className="text-sm font-semibold text-text-primary">{entry.question}</dt>
                <dd className="mt-1 text-sm text-text-secondary">{entry.answer}</dd>
              </div>
            ))}
          </dl>
        </article>
      </section>

      <Script id="pricing-jsonld" type="application/ld+json">
        {JSON.stringify(productSchema)}
      </Script>
      <Script id="faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </Script>
    </div>
  );
}
