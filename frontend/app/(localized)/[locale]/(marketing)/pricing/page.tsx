import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import dynamic from 'next/dynamic';
import { resolveDictionary } from '@/lib/i18n/server';
import { DEFAULT_MARKETING_SCENARIO, scenarioToPricingInput, type PricingScenario } from '@/lib/pricing-scenarios';
import { FEATURES } from '@/content/feature-flags';
import { FlagPill } from '@/components/FlagPill';
import { getMembershipTiers } from '@/lib/membership';
import { FAQSchema } from '@/components/seo/FAQSchema';
import { localePathnames, localeRegions, type AppLocale } from '@/i18n/locales';
import { buildSlugMap } from '@/lib/i18nSlugs';
import { buildMetadataUrls, SITE_BASE_URL } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { listFalEngines } from '@/config/falEngines';
import { computePricingSnapshot, listPricingRules } from '@/lib/pricing';
import type { PricingRuleLite } from '@/lib/pricing-rules';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { TextLink } from '@/components/ui/TextLink';

const PRICING_SLUG_MAP = buildSlugMap('pricing');

const PriceEstimator = dynamic(
  () => import('@/components/marketing/PriceEstimator').then((mod) => mod.PriceEstimator)
);

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
  const breadcrumbLabels = getBreadcrumbLabels(locale as AppLocale);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const homeUrl = `${SITE_BASE_URL}${localePrefix || ''}`;
  const exploreTitle =
    locale === 'fr' ? 'Explorer les moteurs' : locale === 'es' ? 'Explorar motores' : 'Explore engines';
  const exploreModelsLabel = locale === 'fr' ? 'Modèles' : locale === 'es' ? 'Modelos' : 'Models';
  const exploreExamplesLabel = locale === 'fr' ? 'Exemples' : locale === 'es' ? 'Ejemplos' : 'Examples';
  const exploreLinks = [
    { href: { pathname: '/models' }, label: exploreModelsLabel },
    { href: { pathname: '/examples' }, label: exploreExamplesLabel },
    { href: { pathname: '/models/[slug]', params: { slug: 'sora-2' } }, label: 'Sora 2' },
    { href: { pathname: '/models/[slug]', params: { slug: 'veo-3-1' } }, label: 'Veo 3.1' },
    { href: { pathname: '/models/[slug]', params: { slug: 'kling-2-5-turbo' } }, label: 'Kling' },
    { href: { pathname: '/models/[slug]', params: { slug: 'pika-text-to-video' } }, label: 'Pika' },
  ];
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
  const pricingRules = await listPricingRules();
  const pricingRulesLite: PricingRuleLite[] = pricingRules.map((rule) => ({
    id: rule.id,
    engineId: rule.engineId ?? null,
    resolution: rule.resolution ?? null,
    marginPercent: rule.marginPercent,
    marginFlatCents: rule.marginFlatCents,
    currency: rule.currency ?? 'USD',
  }));
  const enginePricingOverrides = await listEnginePricingOverrides();
  const engineIndex = new Map(
    listFalEngines().map((entry) => {
      const override = enginePricingOverrides[entry.engine.id];
      const engine = override ? applyEnginePricingOverride(entry.engine, override) : entry.engine;
      return [engine.id, engine];
    })
  );
  const resolveScenarioQuote = async (scenario: PricingScenario) => {
    const input = scenarioToPricingInput(scenario);
    const engineCaps = engineIndex.get(input.engineId);
    if (!engineCaps) return null;
    try {
      return await computePricingSnapshot({
        engine: engineCaps,
        durationSec: input.durationSec,
        resolution: input.resolution,
        membershipTier: input.memberTier,
        addons: input.addons,
      });
    } catch {
      return null;
    }
  };
  const starterSnapshot = await resolveScenarioQuote(DEFAULT_MARKETING_SCENARIO);
  const starterCurrency = starterSnapshot?.currency ?? 'USD';
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

  const resolvedExampleCards: ExampleCardConfig[] = await Promise.all(
    exampleCards.map(async (card) => {
      if ((typeof card.price === 'string' && card.price.trim().length > 0) || !card.pricingScenario) {
        return card;
      }
      const snapshot = await resolveScenarioQuote(card.pricingScenario);
      if (!snapshot) {
        return card;
      }
      const priceLabel = formatCurrencyForLocale(
        locale as AppLocale,
        snapshot.currency ?? starterCurrency,
        snapshot.totalCents / 100
      );
      return {
        ...card,
        price: `≈ ${priceLabel}`,
      };
    })
  );

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

  const faqJsonLdEntries = faq.entries.slice(0, 6);

  return (
    <main className="container-page max-w-6xl section">
      <div className="stack-gap-lg">
        <header className="max-w-3xl stack-gap-sm">
          <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{content.hero.title}</h1>
          <p className="text-base leading-relaxed text-text-secondary">{content.hero.subtitle}</p>
          {heroLink ? (
            <p className="text-base leading-relaxed text-text-secondary">
              {heroLink.before}
              <Link href={{ pathname: '/blog/[slug]', params: { slug: 'compare-ai-video-engines' } }} className="font-semibold text-brand hover:text-brandHover">
                {heroLink.label ?? 'AI video comparison'}
              </Link>
              {heroLink.after}
            </p>
          ) : null}
        </header>

        <section id="estimator" className="scroll-mt-28">
          <div className="mx-auto max-w-4xl">
            <PriceEstimator pricingRules={pricingRulesLite} enginePricingOverrides={enginePricingOverrides} />
          </div>
          <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center gap-2 text-center text-xs text-text-muted sm:flex-row sm:justify-center">
            <FlagPill live={FEATURES.pricing.publicCalculator} />
            <span>
              {content.estimator.walletLink}{' '}
              <Link href={generatorHref} prefetch={false} className="font-semibold text-brand hover:text-brandHover">
                {content.estimator.walletLinkCta}
              </Link>
              .
              {!FEATURES.pricing.publicCalculator ? (
                <span className="ml-1 text-xs text-text-muted">(coming soon)</span>
              ) : null}
            </span>
          </div>
        </section>

        <section aria-labelledby="example-costs">
          <h2 id="example-costs" className="scroll-mt-28 text-2xl font-semibold text-text-primary sm:text-3xl">
            {exampleCosts.title ?? DEFAULT_EXAMPLE_COSTS.title}
          </h2>
          <p className="mb-4 text-sm text-text-secondary">
            {exampleCosts.subtitle ?? DEFAULT_EXAMPLE_COSTS.subtitle}
          </p>
          <div className="grid grid-cols-1 grid-gap-sm sm:grid-cols-3">
            {resolvedExampleCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
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

        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
            {member.title}
            <FlagPill live={FEATURES.pricing.memberTiers} className="ml-3" />
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{member.subtitle}</p>
          <div className="mt-6 grid grid-gap-sm md:grid-cols-3">
            {formattedTiers.map((tier) => (
              <div key={tier.name} className="rounded-card border border-hairline bg-surface-2 p-4">
                <p className="text-sm font-semibold text-text-primary">{tier.name}</p>
                <p className="mt-1 text-xs uppercase tracking-micro text-text-muted">{tier.requirement}</p>
                <p className="mt-3 text-sm text-text-secondary">{tier.benefit}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-card border border-hairline bg-surface/80 p-4 text-sm text-text-secondary shadow-card">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{exploreTitle}</span>
            <div className="flex flex-wrap gap-2">
              {exploreLinks.map((link) => {
                const key = `${link.label}-${typeof link.href === 'string' ? link.href : link.href.pathname}`;
                return (
                <Link
                  key={key}
                  href={link.href}
                  className="inline-flex items-center rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-text-secondary transition hover:border-text-muted hover:text-text-primary"
                >
                  {link.label}
                </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-card border border-hairline bg-surface/90 p-6 text-sm text-text-secondary shadow-card">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
            {content.calculator?.title ?? 'Preview prices in the app'}
          </h2>
          <p className="mt-2">
            {content.calculator?.description ??
              'Open the generator to see the exact price before you create a video.'}
          </p>
          <TextLink href={generatorHref} prefetch={false} className="mt-3 gap-1 text-sm" linkComponent={Link}>
            {content.calculator?.cta ?? 'Open the generator'} <span aria-hidden>→</span>
          </TextLink>
        </section>
        {priceFactors.points?.length ? (
          <section aria-labelledby="price-factors">
            <h2 id="price-factors" className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {priceFactors.title ?? DEFAULT_PRICE_FACTORS.title}
            </h2>
            <ul className="mt-2 space-y-1 text-sm text-text-secondary">
              {priceFactors.points.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
            {teams.title}
            <FlagPill live={FEATURES.pricing.teams} className="ml-3" />
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{teams.description}</p>
          {FEATURES.pricing.teams ? (
            <ul className="mt-4 stack-gap-sm text-sm text-text-secondary">
              {teams.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
        ) : (
          <p className="mt-4 text-sm text-text-secondary">{teams.comingSoonNote}</p>
        )}
      </section>

        <section className="grid grid-gap lg:grid-cols-[1.1fr_0.9fr]">
          <article
            id="refunds-protections"
            className="scroll-mt-28 rounded-card border border-hairline bg-surface p-6 shadow-card"
          >
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">
              {refunds.title}
            </h2>
            <ul className="mt-4 stack-gap-sm text-sm text-text-secondary">
              {refundFeatureItems.map((item) => (
                <li key={item.text} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {item.text}
                    <FlagPill live={item.live} />
                  </span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{faq.title}</h2>
            <dl className="mt-4 stack-gap">
              {faq.entries.map((entry) => (
                <div key={entry.question}>
                  <dt className="text-sm font-semibold text-text-primary">{entry.question}</dt>
                  <dd className="mt-1 text-sm text-text-secondary">{entry.answer}</dd>
                </div>
              ))}
            </dl>
          </article>
        </section>
      </div>

      <Script id="pricing-breadcrumb-jsonld" type="application/ld+json">
        {JSON.stringify(breadcrumbJsonLd)}
      </Script>
      <Script id="pricing-jsonld" type="application/ld+json">
        {JSON.stringify(serviceSchema)}
      </Script>
      <FAQSchema questions={faqJsonLdEntries} />
    </main>
  );
}
