import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { PriceEstimator } from '@/components/marketing/PriceEstimator';
import { resolveDictionary } from '@/lib/i18n/server';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { DEFAULT_MARKETING_SCENARIO, scenarioToPricingInput, type PricingScenario } from '@/lib/pricing-scenarios';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { getMembershipTiers } from '@/lib/membership';
import FaqJsonLd from '@/components/FaqJsonLd';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';

const PRICING_SLUG_MAP = buildSlugMap('pricing');

export const revalidate = 60 * 10;

type ExampleCardConfig = {
  title: string;
  engine: string;
  duration: string;
  resolution: string;
  audio: string;
  price?: string;
  note?: string;
  pricingScenario?: PricingScenario;
};

type ExampleCostsContent = {
  title: string;
  subtitle: string;
  labels: {
    engine: string;
    duration: string;
    resolution: string;
    audio: string;
  };
  cards: ExampleCardConfig[];
};

function formatCurrencyForLocale(locale: AppLocale, currency: string, amount: number) {
  const region = localeRegions[locale] ?? 'en-US';
  return new Intl.NumberFormat(region, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const DEFAULT_EXAMPLE_COSTS: ExampleCostsContent = {
  title: 'Example costs',
  subtitle: 'Realistic runs to help you plan. Prices update as engines evolve.',
  labels: {
    engine: 'Engine',
    duration: 'Duration',
    resolution: 'Resolution',
    audio: 'Audio',
  },
  cards: [
    {
      title: 'Social clip (vertical)',
      engine: 'Pika 2.2',
      duration: '5s',
      resolution: '1080×1920',
      audio: 'Off',
      note: 'Charged only if it succeeds.',
      pricingScenario: {
        engineId: 'pika-text-to-video',
        durationSec: 5,
        resolution: '1080p',
        memberTier: 'member',
      },
    },
    {
      title: 'Cinematic test (landscape)',
      engine: 'Veo 3.1',
      duration: '8s',
      resolution: '1920×1080',
      audio: 'On',
      note: 'Price before you generate.',
      pricingScenario: {
        engineId: 'veo-3-1',
        durationSec: 8,
        resolution: '1080p',
        memberTier: 'member',
      },
    },
    {
      title: 'Sora 2 narrative (voice-over)',
      engine: 'Sora 2',
      duration: '12s',
      resolution: '1280×720',
      audio: 'On',
      note: 'Automatic refund on fail.',
      pricingScenario: {
        engineId: 'sora-2',
        durationSec: 12,
        resolution: '720p',
        memberTier: 'member',
      },
    },
  ],
} as const;

const DEFAULT_PRICE_FACTORS = {
  title: 'What affects price',
  points: [
    'Duration scales linearly (4s / 8s / 12s).',
    'Resolution increases cost at 1080p vs 720p.',
    'Audio adds a small premium on supported engines.',
    'Engine tier (Sora/Veo/Pika/MiniMax) sets the base rate.',
  ],
} as const;

const DEFAULT_SUPPLEMENTAL_FAQ = [
  {
    question: 'Can I use Sora 2 in Europe?',
    answer: 'Direct access is invite-only. MaxVideoAI provides paid access to Sora 2 rendering from Europe via our hub.',
  },
  {
    question: 'Do videos have watermarks?',
    answer: 'No. Renders produced through MaxVideoAI are delivered without watermarks.',
  },
];

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'pricing.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'pricing',
    slugMap: PRICING_SLUG_MAP,
    imageAlt: 'Pricing estimator interface.',
  });
}

export default async function PricingPage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.pricing;
  const teams = content.teams;
  const member = content.member;
  const refunds = content.refunds;
  const faq = content.faq;
  const heroLink = content.hero.link ?? null;
  const canonical = buildMetadataUrls(locale as AppLocale, PRICING_SLUG_MAP, { englishPath: '/pricing' }).canonical;
  const kernel = getPricingKernel();
  const starterQuote = kernel.quote(scenarioToPricingInput(DEFAULT_MARKETING_SCENARIO));
  const starterCurrency = starterQuote.snapshot.currency;
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

  type TierCopy = {
    name?: string;
    requirement?: string;
    requirementThreshold?: string;
    benefit?: string;
    benefitDiscount?: string;
  };
  const membershipTiers = await getMembershipTiers();
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: starterCurrency,
    maximumFractionDigits: 0,
  });
  const memberCopy = {
    requirementDefault: member.requirementDefault ?? 'Default status — applies automatically',
    requirementThreshold: member.requirementThreshold ?? 'Admin threshold: {amount} (rolling 30 days)',
    benefitBase: member.benefitBase ?? 'Baseline rate',
    benefitDiscount: member.benefitDiscount ?? 'Save {percent}% on every render',
  };
  const exampleCosts = content.examples ?? DEFAULT_EXAMPLE_COSTS;
  const exampleLabels = {
    ...DEFAULT_EXAMPLE_COSTS.labels,
    ...(exampleCosts.labels ?? {}),
  };
  const exampleCards: ExampleCardConfig[] =
    Array.isArray(exampleCosts.cards) && exampleCosts.cards.length
      ? (exampleCosts.cards as ExampleCardConfig[])
      : DEFAULT_EXAMPLE_COSTS.cards;
  const priceFactors = content.priceFactors ?? DEFAULT_PRICE_FACTORS;
  const generatorHref = '/generate';

  const resolvedExampleCards: ExampleCardConfig[] = exampleCards.map((card) => {
    if ((typeof card.price === 'string' && card.price.trim().length > 0) || !card.pricingScenario) {
      return card;
    }
    try {
      const quote = kernel.quote({
        ...scenarioToPricingInput(card.pricingScenario),
        addons: card.pricingScenario.addons,
      });
      const priceLabel = formatCurrencyForLocale(locale as AppLocale, quote.snapshot.currency ?? starterCurrency, quote.snapshot.totalCents / 100);
      return {
        ...card,
        price: `≈ ${priceLabel}`,
      };
    } catch (error) {
      console.error('Failed to compute example card price', card.title, error);
      return card;
    }
  });

  const formattedTiers = membershipTiers.map((tier, index) => {
    const tierCopy = Array.isArray(member.tiers) ? ((member.tiers[index] ?? null) as TierCopy | null) : null;
    const name = tierCopy?.name ?? tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);
    const requirement =
      tier.spendThresholdCents <= 0
        ? tierCopy?.requirement ?? memberCopy.requirementDefault
        : (tierCopy?.requirementThreshold ?? memberCopy.requirementThreshold).replace(
            '{amount}',
            currencyFormatter.format(tier.spendThresholdCents / 100)
          );
    const discountPct = tier.discountPercent * 100;
    const pctLabel = discountPct % 1 === 0 ? discountPct.toFixed(0) : discountPct.toFixed(1);
    const benefit =
      discountPct > 0
        ? (tierCopy?.benefitDiscount ?? memberCopy.benefitDiscount).replace('{percent}', pctLabel)
        : tierCopy?.benefit ?? memberCopy.benefitBase;
    return { name, requirement, benefit };
  });

  const supplementalFaq =
    Array.isArray(content.supplementalFaq) && content.supplementalFaq.length
      ? content.supplementalFaq
      : DEFAULT_SUPPLEMENTAL_FAQ;
  const faqJsonLdEntries = [
    ...faq.entries.map((entry) => ({
      q: entry.question,
      a: entry.answer,
    })),
    ...supplementalFaq.map((entry) => ({ q: entry.question, a: entry.answer })),
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
      <header className="max-w-3xl space-y-4">
        <h1 className="text-3xl font-semibold text-text-primary sm:text-4xl">{content.hero.title}</h1>
        <p className="text-base text-text-secondary">{content.hero.subtitle}</p>
        {heroLink ? (
          <p className="text-base text-text-secondary">
            {heroLink.before}
            <Link href={{ pathname: '/blog/[slug]', params: { slug: 'compare-ai-video-engines' } }} className="font-semibold text-accent hover:text-accentSoft">
              {heroLink.label ?? 'AI video comparison'}
            </Link>
            {heroLink.after}
          </p>
        ) : null}
      </header>

      <section className="mt-8 rounded-card border border-hairline bg-white/90 p-6 text-sm text-text-secondary shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">
          {content.calculator?.title ?? 'Preview prices in the app'}
        </h2>
        <p className="mt-2">
          {content.calculator?.description ??
            'Open the generator to see the exact price before you create a video.'}
        </p>
        <Link
          href={generatorHref}
          className="mt-3 inline-flex items-center text-sm font-semibold text-accent transition hover:text-accentSoft"
        >
          {content.calculator?.cta ?? 'Open the generator'} <span aria-hidden>→</span>
        </Link>
      </section>

      <section id="estimator" className="mt-12 scroll-mt-28">
        <div className="mx-auto max-w-4xl">
          <PriceEstimator />
        </div>
        <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center gap-2 text-center text-xs text-text-muted sm:flex-row sm:justify-center">
          <FlagPill live={FEATURES.pricing.publicCalculator} />
          <span>
            {content.estimator.walletLink}{' '}
            <Link href={generatorHref} className="font-semibold text-accent hover:text-accentSoft">
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
          {exampleCosts.title ?? DEFAULT_EXAMPLE_COSTS.title}
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          {exampleCosts.subtitle ?? DEFAULT_EXAMPLE_COSTS.subtitle}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {resolvedExampleCards.map((card) => (
            <div key={card.title} className="rounded-xl border border-hairline bg-white p-4 shadow-card">
              <div className="text-sm font-medium text-text-primary">{card.title}</div>
              <dl className="mt-2 text-sm text-text-secondary">
                <div className="flex justify-between">
                  <dt>{exampleLabels.engine}</dt>
                  <dd>{card.engine}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{exampleLabels.duration}</dt>
                  <dd>{card.duration}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{exampleLabels.resolution}</dt>
                  <dd>{card.resolution}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{exampleLabels.audio}</dt>
                  <dd>{card.audio}</dd>
                </div>
              </dl>
              <div className="mt-3 text-base font-semibold text-text-primary">
                {card.price ?? '—'}
              </div>
              {card.note ? <div className="text-xs text-text-muted">{card.note}</div> : null}
            </div>
          ))}
        </div>
      </section>
      {priceFactors.points?.length ? (
        <section aria-labelledby="price-factors" className="mt-8">
          <h2 id="price-factors" className="text-lg font-semibold text-text-primary">
            {priceFactors.title ?? DEFAULT_PRICE_FACTORS.title}
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-text-secondary">
            {priceFactors.points.map((point) => (
              <li key={point}>• {point}</li>
            ))}
          </ul>
        </section>
      ) : null}

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
    </main>
  );
}
