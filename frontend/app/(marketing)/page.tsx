import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { ProofTabs } from '@/components/marketing/ProofTabs';
import { PriceChip } from '@/components/marketing/PriceChip';
import { resolveDictionary } from '@/lib/i18n/server';
import { DEFAULT_MARKETING_SCENARIO } from '@/lib/pricing-scenarios';
import { HeroMediaTile } from '@/components/marketing/HeroMediaTile';
import { MosaicBackdrop } from '@/components/marketing/MosaicBackdrop';
import { ExamplesOrbitCallout } from '@/components/marketing/ExamplesOrbitCallout';
import { getPricingKernel } from '@/lib/pricing-kernel';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { getHomepageSlots, HERO_SLOT_KEYS } from '@/server/homepage';
import { normalizeEngineId } from '@/lib/engine-alias';
import { listExamples } from '@/server/videos';
import { listFalEngines } from '@/config/falEngines';

type HeroTileConfig = {
  id: string;
  engineId: string;
  label: string;
  videoSrc: string;
  posterSrc: string;
  durationSec: number;
  resolution: string;
  fallbackPriceLabel: string;
  minPriceCents?: number;
  minPriceCurrency?: string;
  showAudioIcon?: boolean;
  alt: string;
};

const HERO_TILES: readonly HeroTileConfig[] = [
  {
    id: 'sora-2',
    engineId: 'sora-2',
    label: 'Sora 2',
    videoSrc: '/hero/sora2.mp4',
    posterSrc: '/hero/sora2.jpg',
    durationSec: 8,
    resolution: '1080p',
    fallbackPriceLabel: 'from $0.43',
    minPriceCents: 43,
    showAudioIcon: true,
    alt: 'Sora 2  -  example clip',
  },
  {
    id: 'veo-3-1',
    engineId: 'veo-3-1',
    label: 'Veo 3.1',
    videoSrc: '/hero/veo3.mp4',
    posterSrc: '/hero/veo3.jpg',
    durationSec: 8,
    resolution: '1080p',
    fallbackPriceLabel: 'from $0.40',
    minPriceCents: 40,
    showAudioIcon: true,
    alt: 'Veo 3.1  -  example clip',
  },
  {
    id: 'pika-22',
    engineId: 'pika-text-to-video',
    label: 'Pika 2.2',
    videoSrc: '/hero/pika-22.mp4',
    posterSrc: '/hero/pika-22.jpg',
    durationSec: 6,
    resolution: '1080p',
    fallbackPriceLabel: 'from $0.24',
    minPriceCents: 24,
    alt: 'Pika 2.2  -  example clip',
  },
  {
    id: 'minimax-hailuo-02',
    engineId: 'minimax-hailuo-02-text',
    label: 'MiniMax Hailuo 02',
    videoSrc: '/assets/gallery/aerial-road.mp4',
    posterSrc: '/hero/minimax-video01.jpg',
    durationSec: 6,
    resolution: '768P',
    fallbackPriceLabel: 'from $0.27',
    minPriceCents: 27,
    alt: 'MiniMax Hailuo 02  -  example clip',
  },
] as const;

const WORKS_WITH_BRANDS = ['Sora 2', 'Veo 3.1', 'Pika 2.2', 'MiniMax Hailuo 02'] as const;

type HeroTilePricingInput = {
  id: string;
  engineId?: string;
  durationSec?: number;
  resolution?: string;
  fallbackPriceLabel: string;
  minPriceCents?: number | null;
  minPriceCurrency?: string | null;
};

async function resolveHeroTilePrices(tiles: HeroTilePricingInput[]) {
  const kernel = getPricingKernel();
  const formatPriceLabel = (cents: number, currency: string) =>
    `from ${new Intl.NumberFormat(CURRENCY_LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(cents / 100)}`;

  const entries = await Promise.all(
    tiles.map(async (tile) => {
      const canonicalId = normalizeEngineId(tile.engineId);
      const minPriceCents = tile.minPriceCents ?? null;
      const minPriceCurrency = tile.minPriceCurrency ?? 'USD';
      const fallbackLabel =
        minPriceCents != null ? formatPriceLabel(minPriceCents, minPriceCurrency) : tile.fallbackPriceLabel;

      if (!canonicalId || !tile.durationSec) {
        return [tile.id, fallbackLabel] as const;
      }

      try {
        const { snapshot } = kernel.quote({
          engineId: canonicalId,
          durationSec: tile.durationSec,
          resolution: tile.resolution ?? '1080p',
          memberTier: 'member',
        });
        let cents = snapshot.totalCents;
        let currency = snapshot.currency;
        if (minPriceCents != null && minPriceCents < snapshot.totalCents) {
          cents = minPriceCents;
          currency = minPriceCurrency;
        }
        return [tile.id, formatPriceLabel(cents, currency)] as const;
      } catch {
        return [tile.id, fallbackLabel] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

export const metadata: Metadata = {
  title: 'MaxVideo AI  -  The right engine for every shot',
  description: 'Professional AI video, minus the hassle. Price before you generate. One hub for your work.',
  keywords: ['AI video', 'text-to-video', 'price calculator', 'pay-as-you-go', 'model-agnostic'],
  openGraph: {
    title: 'MaxVideo AI  -  The right engine for every shot',
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
    canonical: 'https://maxvideoai.com',
    languages: {
      en: 'https://maxvideoai.com',
      fr: 'https://maxvideoai.com/?lang=fr',
    },
  },
};

export default async function HomePage() {
  const { dictionary } = resolveDictionary();
  const home = dictionary.home;
  const badges = home.badges;
  const hero = home.hero;
  const worksWith = home.worksWith;
  const heroScreenshot = home.heroScreenshot;
  const whyCards = home.whyCards;
  const ways = home.ways;
  const pricing = home.pricing;
  const trust = home.trust;
  const waysSection = home.waysSection;
  const homepageSlots = await getHomepageSlots();
  const falEngines = listFalEngines();
  const proofBackgroundMedia = (await listExamples('date-desc', 20))
    .map((video) => {
      const videoUrl = video.videoUrl ?? null;
      const posterUrl = video.thumbUrl ?? null;
      return { videoUrl, posterUrl };
    })
    .filter((item): item is { videoUrl: string | null; posterUrl: string | null } => Boolean(item.videoUrl || item.posterUrl));

  const heroTileConfigs = HERO_SLOT_KEYS.map((key, index) => {
    const slot = homepageSlots.hero.find((entry) => entry.key === key);
    const fallback = HERO_TILES[index] ?? HERO_TILES[0];
    const video = slot?.video ?? null;
    const label = slot?.title || video?.engineLabel || fallback.label;
    const videoSrc = video?.videoUrl ?? fallback.videoSrc;
    const posterSrc = video?.thumbUrl ?? fallback.posterSrc;
    const alt = slot?.subtitle || video?.promptExcerpt || fallback.alt;
    const engineId = normalizeEngineId(video?.engineId ?? fallback.engineId) ?? fallback.engineId;
    const durationSec = video?.durationSec ?? fallback.durationSec;
    const resolution = fallback.resolution;

    return {
      id: key,
      label,
      videoSrc,
      posterSrc,
      alt,
      showAudioIcon: fallback.showAudioIcon ?? false,
      engineId,
      durationSec,
      resolution,
      fallbackPriceLabel: fallback.fallbackPriceLabel,
      minPriceCents: fallback.minPriceCents ?? null,
      minPriceCurrency: fallback.minPriceCurrency ?? 'USD',
    };
  });

  const heroPriceMap = await resolveHeroTilePrices(
    heroTileConfigs.map((tile) => ({
      id: tile.id,
      engineId: tile.engineId,
      durationSec: tile.durationSec,
      resolution: tile.resolution,
      fallbackPriceLabel: tile.fallbackPriceLabel,
      minPriceCents: tile.minPriceCents,
      minPriceCurrency: tile.minPriceCurrency,
    }))
  );

  const examplesCalloutCopy = home.examplesCallout ?? {
    eyebrow: 'Live gallery',
    title: 'See how every engine routes the same brief.',
    subtitle: 'Watch real renders orbit the CTA and jump straight into the Examples page to clone settings for your own project.',
    cta: 'Browse live examples',
  };

  const orbitEngineMap = new Map<string, { id: string; label: string; brandId?: string }>();
  heroTileConfigs.forEach((tile) => {
    const engineConfig = falEngines.find((entry) => {
      const normalized = normalizeEngineId(entry.id) ?? entry.id;
      return entry.id === tile.engineId || normalized === tile.engineId;
    });
    orbitEngineMap.set(tile.engineId, {
      id: tile.engineId,
      label: engineConfig?.engine.label ?? tile.label,
      brandId: engineConfig?.engine.brandId ?? engineConfig?.brandId,
    });
  });
  falEngines.forEach((entry) => {
    if (!orbitEngineMap.has(entry.id)) {
      orbitEngineMap.set(entry.id, {
        id: entry.id,
        label: entry.engine.label,
        brandId: entry.engine.brandId ?? entry.brandId,
      });
    }
  });
  const orbitEngines = Array.from(orbitEngineMap.values()).slice(0, 6);

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
    url: 'https://maxvideoai.com',
  };
  const videoJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: 'MaxVideoAI - Generate cinematic AI video',
    description: 'Create watermark-free AI videos with Sora 2, Veo 3.1, Veo 3 Fast, Pika 2.2, MiniMax Hailuo 02, and Hunyuan Image.',
    thumbnailUrl: ['https://maxvideoai.com/og/price-before.png'],
    uploadDate: '2025-10-01T12:00:00+00:00',
    duration: 'PT45S',
    contentUrl: 'https://maxvideoai.com/hero/sora2.mp4',
    embedUrl: 'https://maxvideoai.com/',
    publisher: {
      '@type': 'Organization',
      name: 'MaxVideoAI',
      logo: {
        '@type': 'ImageObject',
        url: 'https://maxvideoai.com/favicon-512.png',
      },
    },
  };
  return (
    <div className="pb-24">
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-4 pt-20 pb-16 text-center sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {badges.map((badge) => (
            <span key={badge} className="rounded-pill border border-hairline bg-white px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary">
              {badge}
            </span>
          ))}
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">{hero.title}</h1>
          <p className="mx-auto max-w-2xl text-lg text-text-secondary">
            {hero.subtitle}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/app"
            className="inline-flex items-center rounded-pill bg-accent px-6 py-3 text-sm font-semibold text-white shadow-card transition hover:bg-accentSoft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Launch the MaxVideoAI workspace"
          >
            {hero.primaryCta}
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center rounded-pill border border-hairline px-6 py-3 text-sm font-semibold text-text-primary transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label="Jump to the How it works section"
          >
            {hero.secondaryCta}
          </Link>
        </div>
        <div className="grid w-full gap-4 sm:grid-cols-2">
          {heroTileConfigs.map((tile, index) => (
            <HeroMediaTile
              key={tile.id}
              label={tile.label}
              priceLabel={heroPriceMap[tile.id] ?? tile.fallbackPriceLabel}
              videoSrc={tile.videoSrc}
              posterSrc={tile.posterSrc}
              alt={tile.alt}
              showAudioIcon={tile.showAudioIcon}
              priority={index === 0}
              authenticatedHref="/generate"
              guestHref="/login?next=/generate"
            />
          ))}
        </div>
      </section>

      <section className="border-t border-hairline bg-white/90 px-4 py-8 text-text-secondary sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
          <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
            {worksWith.label}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6 text-2xl font-semibold text-text-primary sm:text-3xl">
            {WORKS_WITH_BRANDS.map((brand) => (
              <span key={brand}>{brand}</span>
            ))}
          </div>
          <p className="text-xs text-text-muted">{worksWith.caption}</p>
        </div>
      </section>

      <section className="border-t border-hairline bg-white px-4 py-24 text-left sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col-reverse items-center gap-12 text-center lg:flex-row lg:items-center lg:text-left">
          <div className="w-full max-w-2xl space-y-5 lg:w-[40%]">
            <h2 className="text-3xl font-semibold text-text-primary sm:text-4xl">{heroScreenshot.title}</h2>
            <p className="text-sm text-text-secondary sm:text-base">{heroScreenshot.body}</p>
          </div>
          <div className="relative w-full max-w-4xl">
            <div className="relative mx-auto aspect-[3/2] w-full overflow-hidden rounded-[48px] border border-hairline bg-white shadow-[0_60px_160px_-60px_rgba(28,37,65,0.6)]">
              <Image
                src="/assets/marketing/monitor-mockup-app.png"
                alt={heroScreenshot.alt}
                fill
                sizes="(min-width: 1280px) 960px, (min-width: 1024px) 720px, 100vw"
                priority
                className="object-contain object-center lg:scale-[1.08]"
              />
            </div>
          </div>
        </div>
      </section>
      <MosaicBackdrop media={proofBackgroundMedia}>
        <div id="how-it-works" className="pt-16 sm:pt-20 scroll-mt-32">
          <ProofTabs />
        </div>

        <section className="mx-auto mt-20 max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {whyCards.map((item) => (
              <article key={item.title} className="rounded-card border border-hairline bg-white p-6 shadow-card">
                <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-3 text-sm text-text-secondary">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <ExamplesOrbitCallout
          engines={orbitEngines}
          heading={examplesCalloutCopy.title}
          description={examplesCalloutCopy.subtitle ?? ''}
          ctaLabel={examplesCalloutCopy.cta}
          eyebrow={examplesCalloutCopy.eyebrow}
        />

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
                aria-label="Explore MaxVideoAI pricing"
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
      </MosaicBackdrop>
      <Script id="software-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="home-video-jsonld" type="application/ld+json">
        {JSON.stringify(videoJsonLd)}
      </Script>
    </div>
  );
}
