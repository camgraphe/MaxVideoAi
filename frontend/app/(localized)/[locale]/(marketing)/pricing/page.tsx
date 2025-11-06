import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { PriceEstimator } from '@/components/marketing/PriceEstimator';
import { resolveDictionary } from '@/lib/i18n/server';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { DEFAULT_MARKETING_SCENARIO, scenarioToPricingInput } from '@/lib/pricing-scenarios';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { getMembershipTiers } from '@/lib/membership';
import FaqJsonLd from '@/components/FaqJsonLd';
import type { AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';

const PRICING_SLUG_MAP = buildSlugMap('pricing');

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'pricing.meta' });
  const metadataUrls = buildMetadataUrls(locale, PRICING_SLUG_MAP);

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: metadataUrls.canonical,
      languages: metadataUrls.languages,
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: metadataUrls.canonical,
      siteName: 'MaxVideoAI',
      locale: metadataUrls.ogLocale,
      alternateLocale: metadataUrls.alternateOg,
      images: [
        {
          url: '/og/price-before.png',
          width: 1200,
          height: 630,
          alt: 'Pricing estimator interface.',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
  };
}

export default async function PricingPage() {
  const { locale, dictionary } = await resolveDictionary();
  const content = dictionary.pricing;
  const teams = content.teams;
  const member = content.member;
  const refunds = content.refunds;
  const faq = content.faq;
  const canonical = buildMetadataUrls(locale as AppLocale, PRICING_SLUG_MAP).canonical;
  const kernel = getPricingKernel();
  const starterQuote = kernel.quote(scenarioToPricingInput(DEFAULT_MARKETING_SCENARIO));
  const starterCurrency = starterQuote.snapshot.currency;
  const cookieStore = cookies();
  const isAuthed = Boolean(
    cookieStore.get('sb-access-token')?.value ??
      cookieStore.get('supabase-access-token')?.value ??
      cookieStore.get('supabase-auth-token')?.value
  );
  const refundFeatureItems = [
    { text: refunds.points[0], live: FEATURES.pricing.refundsAuto },
    { text: refunds.points[1], live: FEATURES.pricing.itemisedReceipts },
    { text: refunds.points[2], live: FEATURES.pricing.multiApproverTopups },
  ] as const;

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

  const membershipTiers = await getMembershipTiers();
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: starterCurrency,
    maximumFractionDigits: 0,
  });
  const formattedTiers = membershipTiers.map((tier) => {
    const name = tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);
    const requirement = tier.spendThresholdCents <= 0
      ? 'Default status — applies automatically'
      : `Admin threshold: ${currencyFormatter.format(tier.spendThresholdCents / 100)} (rolling 30 days)`;
    const discountPct = tier.discountPercent * 100;
    const benefit = discountPct > 0
      ? `Save ${discountPct % 1 === 0 ? discountPct.toFixed(0) : discountPct.toFixed(1)}% on every render`
      : 'Baseline rate';
    return { name, requirement, benefit };
  });

  const supplementalFaq = [
    {
      q: 'Can I use Sora 2 in Europe?',
      a: 'Direct access is invite-only. MaxVideoAI provides paid access to Sora 2 rendering from Europe via our hub.',
    },
    {
      q: 'Do videos have watermarks?',
      a: 'No. Renders produced through MaxVideoAI are delivered without watermarks.',
    },
  ] as const;
  const faqJsonLdEntries = [
    ...faq.entries.map((entry) => ({
      q: entry.question,
      a: entry.answer,
    })),
    ...supplementalFaq,
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
        <p className="text-base text-text-secondary">
          See how pricing compares across engines in our{' '}
          <Link href="/blog/compare-ai-video-engines" className="font-semibold text-accent hover:text-accentSoft">
            AI video comparison
          </Link>
          .
        </p>
      </header>

      <section id="estimator" className="mt-12 scroll-mt-28">
        <div className="mx-auto max-w-4xl">
          <PriceEstimator />
        </div>
        <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center gap-2 text-center text-xs text-text-muted sm:flex-row sm:justify-center">
          <FlagPill live={FEATURES.pricing.publicCalculator} />
          <span>
            {content.estimator.walletLink}{' '}
            <Link href="/pricing-calculator" className="font-semibold text-accent hover:text-accentSoft">
              {content.estimator.walletLinkCta}
            </Link>
            .
            {!FEATURES.pricing.publicCalculator ? (
              <span className="ml-1 text-xs text-text-muted">(coming soon)</span>
            ) : null}
          </span>
        </div>
      </section>
      <section aria-labelledby="example-costs" className="mt-10">
        <h2 id="example-costs" className="scroll-mt-28 text-lg font-semibold text-text-primary">
          Example costs
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          Realistic runs to help you plan. Prices update as engines evolve.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-hairline bg-white p-4 shadow-card">
            <div className="text-sm font-medium text-text-primary">Social clip (vertical)</div>
            <dl className="mt-2 text-sm text-text-secondary">
              <div className="flex justify-between">
                <dt>Engine</dt>
                <dd>Pika 2.2</dd>
              </div>
              <div className="flex justify-between">
                <dt>Duration</dt>
                <dd>5s</dd>
              </div>
              <div className="flex justify-between">
                <dt>Resolution</dt>
                <dd>1080×1920</dd>
              </div>
              <div className="flex justify-between">
                <dt>Audio</dt>
                <dd>Off</dd>
              </div>
            </dl>
            <div className="mt-3 text-base font-semibold text-text-primary">≈ $0.25</div>
            <div className="text-xs text-text-muted">Charged only if it succeeds.</div>
          </div>
          <div className="rounded-xl border border-hairline bg-white p-4 shadow-card">
            <div className="text-sm font-medium text-text-primary">Cinematic test (landscape)</div>
            <dl className="mt-2 text-sm text-text-secondary">
              <div className="flex justify-between">
                <dt>Engine</dt>
                <dd>Veo 3.1</dd>
              </div>
              <div className="flex justify-between">
                <dt>Duration</dt>
                <dd>8s</dd>
              </div>
              <div className="flex justify-between">
                <dt>Resolution</dt>
                <dd>1920×1080</dd>
              </div>
              <div className="flex justify-between">
                <dt>Audio</dt>
                <dd>On</dd>
              </div>
            </dl>
            <div className="mt-3 text-base font-semibold text-text-primary">≈ $3.20</div>
            <div className="text-xs text-text-muted">Price before you generate.</div>
          </div>
          <div className="rounded-xl border border-hairline bg-white p-4 shadow-card">
            <div className="text-sm font-medium text-text-primary">Sora 2 narrative (voice-over)</div>
            <dl className="mt-2 text-sm text-text-secondary">
              <div className="flex justify-between">
                <dt>Engine</dt>
                <dd>Sora 2</dd>
              </div>
              <div className="flex justify-between">
                <dt>Duration</dt>
                <dd>12s</dd>
              </div>
              <div className="flex justify-between">
                <dt>Resolution</dt>
                <dd>1920×1080</dd>
              </div>
              <div className="flex justify-between">
                <dt>Audio</dt>
                <dd>On</dd>
              </div>
            </dl>
            <div className="mt-3 text-base font-semibold text-text-primary">≈ $6.20</div>
            <div className="text-xs text-text-muted">Automatic refund on fail.</div>
          </div>
        </div>
      </section>

      <section aria-labelledby="price-factors" className="mt-8">
        <h2 id="price-factors" className="text-lg font-semibold text-text-primary">
          What affects price
        </h2>
        <ul className="mt-2 space-y-1 text-sm text-text-secondary">
          <li>
            • <strong>Duration</strong> scales linearly (4s / 8s / 12s).
          </li>
          <li>
            • <strong>Resolution</strong> increases cost at 1080p vs 720p.
          </li>
          <li>
            • <strong>Audio</strong> adds a small premium on supported engines.
          </li>
          <li>
            • <strong>Engine tier</strong> (Sora/Veo/Pika/MiniMax) sets the base rate.
          </li>
        </ul>
      </section>

      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">
          {teams.title}
          <FlagPill live={FEATURES.pricing.teams} className="ml-3" />
        </h2>
        <p className="mt-2 text-sm text-text-secondary">{teams.description}</p>
        {FEATURES.pricing.teams ? (
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {teams.points.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{teams.comingSoonNote}</p>
        )}
      </section>

      <section className="mt-12 rounded-card border border-hairline bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">
          {member.title}
          <FlagPill live={FEATURES.pricing.memberTiers} className="ml-3" />
        </h2>
        <p className="mt-2 text-sm text-text-secondary">{member.subtitle}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {formattedTiers.map((tier) => (
            <div key={tier.name} className="rounded-card border border-hairline bg-bg p-4">
              <p className="text-sm font-semibold text-text-primary">{tier.name}</p>
              <p className="mt-1 text-xs uppercase tracking-micro text-text-muted">{tier.requirement}</p>
              <p className="mt-3 text-sm text-text-secondary">{tier.benefit}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article
          id="refunds-protections"
          className="scroll-mt-28 rounded-card border border-hairline bg-white p-6 shadow-card"
        >
          <h2 className="text-xl font-semibold text-text-primary">
            {refunds.title}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-text-secondary">
            {refundFeatureItems.map((item) => (
              <li key={item.text} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                <span className="inline-flex flex-wrap items-center gap-2">
                  {item.text}
                  <FlagPill live={item.live} />
                </span>
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
        {JSON.stringify(serviceSchema)}
      </Script>
      <FaqJsonLd qa={faqJsonLdEntries} />
    </div>
  );
}
