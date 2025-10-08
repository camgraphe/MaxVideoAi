import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import clsx from 'clsx';
import { ProofTabs } from '@/components/marketing/ProofTabs';
import { GalleryShowcase } from '@/components/marketing/GalleryShowcase';
import { PriceChip } from '@/components/marketing/PriceChip';
import { resolveDictionary } from '@/lib/i18n/server';
import Image from 'next/image';
import { PARTNER_BRAND_MAP } from '@/lib/brand-partners';
import { DEFAULT_MARKETING_SCENARIO } from '@/lib/pricing-scenarios';
import { listAvailableModels } from '@/lib/model-roster';
import type { ModelAvailability } from '@/lib/model-roster';
import { AVAILABILITY_BADGE_CLASS } from '@/lib/availability';
import type { PartnerBrand } from '@/lib/brand-partners';

export const metadata: Metadata = {
  title: 'MaxVideo AI — The right engine for every shot',
  description: 'Professional AI video, minus the hassle. Price before you generate. One hub for your work.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'MaxVideo AI — The right engine for every shot',
    description: 'Pay-as-you-go AI video workflows with current models, pricing transparency, and branded outputs.',
    images: [
      {
        url: '/og/price-before.png',
        width: 1200,
        height: 630,
        alt: 'MaxVideo AI home hero with Price-Before chip.',
      },
    ],
  },
  alternates: {
    canonical: 'https://www.maxvideo.ai/',
    languages: {
      en: 'https://www.maxvideo.ai/',
      fr: 'https://www.maxvideo.ai/?lang=fr',
    },
  },
};

export default function HomePage() {
  const { dictionary } = resolveDictionary();
  const home = dictionary.home;
  const badges = home.badges;
  const hero = home.hero;
  const worksWith = home.worksWith;
  const whyCards = home.whyCards;
  const ways = home.ways;
  const pricing = home.pricing;
  const trust = home.trust;
  const waysSection = home.waysSection;
  const availabilityLabels = dictionary.models.availabilityLabels;
  const rosterEntries = listAvailableModels(true);
  const availabilityRanking: Record<ModelAvailability, number> = {
    available: 0,
    limited: 1,
    waitlist: 2,
    paused: 3,
  };
  const worksWithEntries = Array.from(
    rosterEntries.reduce((map, entry) => {
      const existing = map.get(entry.brandId);
      if (!existing || availabilityRanking[entry.availability] < availabilityRanking[existing.availability]) {
        map.set(entry.brandId, entry);
      }
      return map;
    }, new Map<string, typeof rosterEntries[number]>())
  )
    .map(([, entry]) => entry)
    .sort((a, b) => a.brandId.localeCompare(b.brandId, 'en'));
  const hasRestrictedModels = worksWithEntries.some((entry) => entry.availability === 'limited' || entry.availability === 'waitlist');
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'Video',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '5.00',
      priceCurrency: 'USD',
      category: 'Starter credits',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '3200',
    },
    description: metadata.description,
    url: 'https://www.maxvideo.ai/',
  };
  return (
    <div className="pb-24">
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 pt-16 text-center sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {badges.map((badge) => (
            <span key={badge} className="rounded-pill border border-hairline bg-white px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary">
              {badge}
            </span>
          ))}
        </div>
        <div className="space-y-5">
          <h1 className="text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">{hero.title}</h1>
          <p className="mx-auto max-w-2xl text-lg text-text-secondary">{hero.subtitle}</p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex items-center rounded-pill bg-accent px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {hero.primaryCta}
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center rounded-pill border border-hairline px-6 py-3 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            {hero.secondaryCta}
          </Link>
        </div>
        <div className="mt-6 flex w-full flex-col items-center gap-4 rounded-card border border-hairline bg-white/85 px-6 py-5 text-center shadow-card sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <span className="text-sm font-medium uppercase tracking-tiny text-text-muted">{worksWith.label}</span>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {worksWithEntries.map((entry) => {
              const brand = PARTNER_BRAND_MAP.get(entry.brandId) as PartnerBrand | undefined;
              const availabilityLabel = availabilityLabels?.[entry.availability] ?? entry.availability;
              const modelMeta = dictionary.models.meta?.[entry.modelSlug];
              const displayName = modelMeta?.displayName ?? entry.marketingName;
              return (
                <div key={entry.modelSlug} className="flex flex-col items-center gap-2">
                  {entry.logoPolicy === 'logoAllowed' && brand ? (
                    <Link href={`/models/${entry.modelSlug}`} className="flex items-center">
                      <Image src={brand.assets.light.svg} alt={`${displayName} logo`} width={120} height={32} className="h-8 w-auto transition hover:scale-105 dark:hidden" />
                      <Image src={brand.assets.dark.svg} alt={`${displayName} logo`} width={120} height={32} className="hidden h-8 w-auto transition hover:scale-105 dark:inline-flex" />
                      <span className="sr-only">{displayName}</span>
                    </Link>
                  ) : (
                    <Link
                      href={`/models/${entry.modelSlug}`}
                      className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary hover:border-accent hover:text-accent"
                    >
                      Works with {displayName}
                    </Link>
                  )}
                  <span
                    className={clsx(
                      'rounded-pill border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-micro text-text-secondary',
                      AVAILABILITY_BADGE_CLASS[entry.availability]
                    )}
                  >
                    {availabilityLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col items-center gap-1 text-xs text-text-muted sm:items-end">
            {hasRestrictedModels && <span className="text-center sm:text-right">{worksWith.availabilityNotice}</span>}
            <span className="text-center sm:text-right">{worksWith.caption}</span>
          </div>
        </div>
      </section>

      <div id="how-it-works">
        <ProofTabs />
      </div>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {whyCards.map((item) => (
            <article key={item.title} className="rounded-card border border-hairline bg-white p-6 shadow-card">
              <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-3 text-sm text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{waysSection.title}</h2>
            <p className="text-sm text-text-secondary sm:text-base">{waysSection.subtitle}</p>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {ways.map((item) => (
            <article key={item.title} className="flex flex-col gap-4 rounded-card border border-hairline bg-white p-6 shadow-card">
              <div>
                <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">{item.title}</span>
              </div>
              <h3 className="text-xl font-semibold text-text-primary">{item.description}</h3>
              <ul className="space-y-2 text-sm text-text-secondary">
                {item.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <GalleryShowcase />

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
            <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
              {pricing.badge}
            </span>
            <h3 className="mt-4 text-xl font-semibold text-text-primary">{pricing.title}</h3>
            <p className="mt-3 text-sm text-text-secondary">{pricing.body}</p>
            <div className="mt-5">
              <PriceChip {...DEFAULT_MARKETING_SCENARIO} suffix={home.priceChipSuffix} />
            </div>
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center text-sm font-semibold text-accent hover:text-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            >
              {pricing.link}
            </Link>
          </article>
          <article className="rounded-card border border-hairline bg-white p-6 shadow-card">
            <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
              {trust.badge}
            </span>
            <ul className="mt-4 space-y-3 text-sm text-text-secondary">
              {trust.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
      <Script id="software-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
    </div>
  );
}
