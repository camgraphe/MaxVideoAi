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
import { CompareEnginesCarousel, type CompareEngineCard } from '@/components/marketing/CompareEnginesCarousel';
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
  examplesSlug?: string | null;
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
    examplesSlug: 'sora-2',
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
    examplesSlug: 'veo-3-1',
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
    examplesSlug: 'pika-2-2',
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
    examplesSlug: 'minimax-hailuo-02',
  },
] as const;

const WORKS_WITH_BRANDS = ['Sora 2', 'Veo 3.1', 'Pika 2.2', 'MiniMax Hailuo 02'] as const;

const HERO_TILE_EXAMPLE_SLUGS: Record<string, string> = {
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'veo-3-1': 'veo-3-1',
  'veo-3-fast': 'veo-3-fast',
  'pika-text-to-video': 'pika-2-2',
  'pika-2-2': 'pika-2-2',
  'minimax-hailuo-02-text': 'minimax-hailuo-02',
  'minimax-hailuo-02': 'minimax-hailuo-02',
};

const COMPARE_ENGINE_PRIORITY: readonly string[] = [
  'sora-2',
  'sora-2-pro',
  'veo-3-1',
  'veo-3-fast',
  'veo-3-1-fast',
  'pika-text-to-video',
  'pika-image-to-video',
  'minimax-hailuo-02-text',
  'minimax-hailuo-02-image',
];

const COMPARE_ENGINE_META: Record<
  string,
  {
    maxDuration: string;
    audio: string;
    bestFor: string;
  }
> = {
  'sora-2': { maxDuration: '6–8s', audio: 'Yes', bestFor: 'Cinematic shots' },
  'sora-2-pro': { maxDuration: '6–8s', audio: 'Yes', bestFor: 'Studio-grade Sora renders' },
  'veo-3-1': { maxDuration: '8–12s', audio: 'Yes', bestFor: 'Ads & B-roll' },
  'veo-3-fast': { maxDuration: '4–8s', audio: 'Yes', bestFor: 'Faster Veo iterations' },
  'veo-3-1-fast': { maxDuration: '4–8s', audio: 'Yes', bestFor: 'Frame-to-frame bridges' },
  'pika-text-to-video': { maxDuration: '3–6s', audio: 'No', bestFor: 'Fast prompts' },
  'pika-image-to-video': { maxDuration: '3–6s', audio: 'No', bestFor: 'Image animations' },
  'minimax-hailuo-02-text': { maxDuration: '6–8s', audio: 'No', bestFor: 'Stylised motion' },
  'minimax-hailuo-02-image': { maxDuration: '6–8s', audio: 'No', bestFor: 'Image-to-video loops' },
};

function MiniFAQ() {
  const items = [
    {
      q: 'Is Sora 2 available in the EU?',
      a: 'Sora 2 availability is limited. MaxVideoAI routes your brief to supported engines today and keeps Sora-ready presets for later.',
    },
    {
      q: 'Can I add audio?',
      a: 'Yes. Engines surfaced on the homepage support audio toggles in the composer. The live price updates when you enable audio.',
    },
    {
      q: 'How does pricing work?',
      a: 'You see a live price chip before you render. Load $10 to start and top up anytime. Itemised receipts for each job.',
    },
    {
      q: "What’s the refund policy?",
      a: 'Failed renders auto-refund to your wallet with an itemised receipt. You always keep full control of spend.',
    },
  ];

  return (
    <section aria-labelledby="mini-faq-heading" className="mx-auto mt-20 max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-hairline bg-white p-6 shadow-card">
        <h2 id="mini-faq-heading" className="text-xl font-semibold text-text-primary">
          FAQ
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">Short answers to the most common questions.</p>
        <div className="space-y-3">
          {items.map((item) => (
            <details key={item.q} className="group rounded-lg border border-hairline bg-white/60 p-4 transition hover:border-accent/40">
              <summary className="flex cursor-pointer select-none list-none items-center justify-between text-sm font-medium text-text-primary">
                <span>{item.q}</span>
                <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-180">▾</span>
              </summary>
              <div className="mt-2 text-sm text-text-secondary">{item.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

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

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://maxvideoai.com';

export const metadata: Metadata = {
  title: 'MaxVideo AI — The right engine for every shot',
  description:
    'Independent hub for AI video. Price before you generate. Works with Sora 2, Veo 3.1, Pika 2.2, MiniMax Hailuo 02. Wallet-first billing & automatic refunds.',
  alternates: {
    canonical: `${SITE}/`,
    languages: {
      en: `${SITE}/`,
      fr: `${SITE}/?lang=fr`,
    },
  },
  openGraph: {
    type: 'website',
    url: `${SITE}/`,
    siteName: 'MaxVideo AI',
    title: 'The right engine for every shot — MaxVideo AI',
    description: 'Price-before-you-generate AI video across Sora, Veo, Pika, MiniMax — in one workspace.',
    images: [
      {
        url: `${SITE}/og/price-before.png`,
        width: 1200,
        height: 630,
        alt: 'MaxVideo AI workspace and example outputs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MaxVideo AI — Price before you generate',
    description: 'Route the same brief across Sora, Veo, Pika, MiniMax. Wallet-first billing. Automatic refunds.',
    images: [`${SITE}/og/price-before.png`],
  },
  robots: {
    index: true,
    follow: true,
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
  const compareEngineIndex = new Map(falEngines.map((entry) => [entry.modelSlug, entry]));
  const compareEngines: CompareEngineCard[] = COMPARE_ENGINE_PRIORITY.map((slug) => {
    const entry = compareEngineIndex.get(slug);
    if (!entry) {
      return null;
    }
    const meta = COMPARE_ENGINE_META[slug] ?? { maxDuration: '—', audio: '—', bestFor: '—' };
    const name = entry.cardTitle ?? entry.marketingName ?? entry.engine.label;
    const bg = entry.media?.imagePath ?? '/hero/veo3.jpg';
    return {
      key: slug,
      name,
      maxDuration: meta.maxDuration,
      audio: meta.audio,
      bestFor: meta.bestFor,
      href: `/models/${slug}`,
      bg,
    };
  }).filter((item): item is CompareEngineCard => Boolean(item));
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
      examplesSlug: HERO_TILE_EXAMPLE_SLUGS[engineId] ?? fallback.examplesSlug ?? (engineId.includes('/') ? null : engineId),
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
            aria-label="Start a render in the workspace"
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
        <p className="mt-2 text-center text-sm text-muted-foreground">
          <Link href="/pricing" className="underline underline-offset-2">
            Preview pricing
          </Link>
        </p>
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
              overlayHref={tile.examplesSlug ? `/examples?engine=${encodeURIComponent(tile.examplesSlug)}` : undefined}
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
        <CompareEnginesCarousel engines={compareEngines} />

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
              <p className="mt-3 text-sm text-muted-foreground">
                3,000+ internal test renders · automatic refunds on failures · wallet-first billing
              </p>
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
      <MiniFAQ />
      <Script id="software-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="home-video-jsonld" type="application/ld+json">
        {JSON.stringify(videoJsonLd)}
      </Script>
      <Script
        id="home-organization-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'MaxVideo AI',
            url: 'https://maxvideoai.com',
            logo: 'https://maxvideoai.com/logo-wordmark.svg',
            sameAs: [],
            description:
              'Independent hub for AI video generation. Price before you generate. Works with Sora, Veo, Pika, MiniMax.',
          }),
        }}
      />
      <Script
        id="home-software-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'MaxVideo AI',
            applicationCategory: 'VideoEditorApplication',
            operatingSystem: 'Web',
            url: 'https://maxvideoai.com',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'USD',
              description: 'Pay-as-you-go. Load credits to render; no subscription.',
            },
            featureList: [
              'Multi-engine routing (Sora, Veo, Pika, MiniMax)',
              'Live pricing before render',
              'Wallet-first billing with automatic refunds',
              'Composer, gallery, and job tracking in one workspace',
            ],
            publisher: {
              '@type': 'Organization',
              name: 'MaxVideo AI',
            },
          }),
        }}
      />
      <Script
        id="home-faq-jsonld"
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Is Sora 2 available in the EU?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text:
                    'Sora 2 availability is limited. MaxVideoAI routes your brief to supported engines today and keeps Sora-ready presets for later.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I add audio?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text:
                    'Yes. Engines surfaced on the homepage support audio toggles in the composer. The live price updates when you enable audio.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does pricing work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text:
                    'You see a live price chip before you render. Load $10 to start and top up anytime. Itemised receipts for each job.',
                },
              },
              {
                '@type': 'Question',
                name: "What’s the refund policy?",
                acceptedAnswer: {
                  '@type': 'Answer',
                  text:
                    'Failed renders auto-refund to your wallet with an itemised receipt. You always keep full control of spend.',
                },
              },
            ],
          }),
        }}
      />
      <div className="mt-12 flex justify-center">
        <a href="https://www.wavel.io/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
          <img
            src="https://www.wavel.io/badges/featured-light.svg"
            alt="Featured on Wavel"
            width="120"
            height="40"
          />
        </a>
      </div>
    </div>
  );
}
