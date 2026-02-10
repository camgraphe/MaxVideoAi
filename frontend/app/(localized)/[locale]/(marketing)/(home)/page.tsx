import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Image, { getImageProps } from 'next/image';
import { Link } from '@/i18n/navigation';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { PriceChip } from '@/components/marketing/PriceChip';
import { ButtonLink } from '@/components/ui/Button';
import { TextLink } from '@/components/ui/TextLink';
import { resolveDictionary } from '@/lib/i18n/server';
import { DEFAULT_MARKETING_SCENARIO } from '@/lib/pricing-scenarios';
import { HeroMediaTile } from '@/components/marketing/HeroMediaTile';
import { CURRENCY_LOCALE } from '@/lib/intl';
import { PartnerBadges } from '@/components/marketing/PartnerBadges';
import { getHomepageSlotsCached, HERO_SLOT_KEYS } from '@/server/homepage';
import { normalizeEngineId } from '@/lib/engine-alias';
import { listFalEngines } from '@/config/falEngines';
import type { CompareEngineEntry } from '@/components/marketing/CompareEnginesCarousel';
import type { EngineCaps } from '@/types/engines';
import type { AppLocale } from '@/i18n/locales';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { computePricingSnapshot, listPricingRules } from '@/lib/pricing';
import type { PricingRuleLite } from '@/lib/pricing-rules';

export const revalidate = 60;

const ProofTabs = dynamic(
  () =>
    import('@/components/marketing/ProofTabs').then((mod) => ({
      default: mod.ProofTabs,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto mt-6 h-48 w-full max-w-6xl animate-pulse rounded-card bg-surface/40" aria-hidden />
    ),
  }
);

const CompareEnginesCarousel = dynamic(
  () =>
    import('@/components/marketing/CompareEnginesCarousel').then((mod) => ({
      default: mod.CompareEnginesCarousel,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto mt-10 h-64 w-full max-w-6xl animate-pulse rounded-card bg-surface/40" aria-hidden />
    ),
  }
);

const ExamplesOrbitCallout = dynamic(
  () =>
    import('@/components/marketing/ExamplesOrbitCallout').then((mod) => ({
      default: mod.ExamplesOrbitCallout,
    })),
  {
    ssr: false,
    loading: () => (
      <section className="container-page section w-full max-w-6xl">
        <div className="h-[380px] animate-pulse rounded-[40px] border border-hairline bg-surface/70 shadow-card" aria-hidden />
      </section>
    ),
  }
);

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
  adminPriceLabel?: string | null;
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
    fallbackPriceLabel: 'from $0.52',
    minPriceCents: 52,
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
    videoSrc: '/hero/minimax-video01.mp4',
    posterSrc: '/hero/minimax-video01.jpg',
    durationSec: 6,
    resolution: '768P',
    fallbackPriceLabel: 'from $0.27',
    minPriceCents: 27,
    alt: 'MiniMax Hailuo 02  -  example clip',
    examplesSlug: 'minimax-hailuo-02',
  },
] as const;

const HERO_POSTER_WIDTH = 1200;
const HERO_POSTER_HEIGHT = 675;
const HERO_POSTER_QUALITY = 80;

function buildOptimizedPoster(src: string): string {
  if (!src) return src;
  if (src.startsWith('/_next/image') || src.includes('/_next/image?')) {
    return src;
  }
  const { props } = getImageProps({
    src,
    alt: '',
    width: HERO_POSTER_WIDTH,
    height: HERO_POSTER_HEIGHT,
    quality: HERO_POSTER_QUALITY,
    priority: true,
  });
  return props.src;
}

const WORKS_WITH_BRANDS = [
  'Sora 2',
  'Veo 3.1',
  'LTX-2 Fast',
  'LTX-2 Pro',
  'Kling 2.6 Pro',
  'Kling 3 Pro',
  'Pika 2.2',
  'MiniMax Hailuo 02',
  'Kling 2.5',
  'Wan 2.5',
  'Nano Banana',
] as const;

const HERO_TILE_EXAMPLE_SLUGS: Record<string, string> = {
  'sora-2': 'sora-2',
  'sora-2-pro': 'sora-2-pro',
  'veo-3-1': 'veo-3-1',
  'veo-3-1-fast': 'veo-3-1-fast',
  'pika-text-to-video': 'pika-2-2',
  'pika-2-2': 'pika-2-2',
  'minimax-hailuo-02-text': 'minimax-hailuo-02',
  'minimax-hailuo-02': 'minimax-hailuo-02',
};

const COMPARE_ENGINE_PRIORITY: readonly string[] = [
  'sora-2',
  'sora-2-pro',
  'veo-3-1',
  'veo-3-1-fast',
  'ltx-2-fast',
  'ltx-2',
  'kling-3-pro',
  'kling-2-6-pro',
  'pika-text-to-video',
  'minimax-hailuo-02-text',
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
  'veo-3-1-fast': { maxDuration: '4–8s', audio: 'Yes', bestFor: 'Frame-to-frame bridges' },
  'ltx-2-fast': { maxDuration: '6–20s', audio: 'Yes', bestFor: 'Rapid social clips' },
  'ltx-2': { maxDuration: '6–10s', audio: 'Yes', bestFor: 'Premium product stories' },
  'kling-3-pro': { maxDuration: '3–15s', audio: 'Yes', bestFor: 'Multi-shot cinematic control' },
  'kling-2-6-pro': { maxDuration: '5–10s', audio: 'Yes', bestFor: 'Cinematic dialogue' },
  'pika-text-to-video': { maxDuration: '5–10s', audio: 'No', bestFor: 'Prompts or image loops' },
  'minimax-hailuo-02-text': { maxDuration: '6–8s', audio: 'No', bestFor: 'Stylised text/image motion' },
};

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'home',
    imageAlt: t('title'),
  });
}

type MiniFaqProps = {
  faq?: {
    title?: string;
    description?: string;
    items?: Array<{ q: string; a: string }>;
  } | null;
};

function MiniFAQ({ faq }: MiniFaqProps) {
  const fallback = {
    title: 'FAQ',
    description: 'Short answers to the most common questions.',
    items: [
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
    ],
  };

  const resolvedTitle = faq?.title ?? fallback.title;
  const resolvedDescription = faq?.description ?? fallback.description;
  const items =
    Array.isArray(faq?.items) && faq.items.length
      ? faq.items
      : fallback.items;

  return (
    <section aria-labelledby="mini-faq-heading" className="container-page section max-w-6xl">
      <div className="rounded-2xl border border-hairline bg-surface p-6 shadow-card">
        <h2 id="mini-faq-heading" className="text-xl font-semibold text-text-primary">
          {resolvedTitle}
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">{resolvedDescription}</p>
        <div className="stack-gap-sm">
          {items.map((item) => (
            <details key={item.q} className="group rounded-lg border border-hairline bg-surface/60 p-4 transition hover:border-text-muted">
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

function pickResolution(resolutions: string[] | undefined, requested: string | undefined) {
  if (!resolutions || !resolutions.length) {
    return requested ?? '1080p';
  }
  if (requested && resolutions.includes(requested)) return requested;
  const nonAuto = resolutions.find((value) => value !== 'auto') ?? resolutions[0];
  return nonAuto ?? requested ?? '1080p';
}

async function resolveHeroTilePrices(tiles: HeroTilePricingInput[]) {
  const engineIndex = new Map<string, EngineCaps>(
    listFalEngines().map((entry) => [entry.engine.id, entry.engine])
  );
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
        const engineCaps = engineIndex.get(canonicalId) ?? engineIndex.get(tile.engineId ?? '');
        if (!engineCaps) {
          return [tile.id, fallbackLabel] as const;
        }
        const resolution = pickResolution(engineCaps.resolutions as string[] | undefined, tile.resolution);
        const snapshot = await computePricingSnapshot({
          engine: engineCaps,
          durationSec: tile.durationSec,
          resolution,
          membershipTier: 'member',
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

export default async function HomePage({ params }: { params: { locale: AppLocale } }) {
  const { dictionary } = await resolveDictionary({ locale: params.locale });
  const home = dictionary.home;
  const pricingRules = await listPricingRules();
  const pricingRulesLite: PricingRuleLite[] = pricingRules.map((rule) => ({
    id: rule.id,
    engineId: rule.engineId ?? null,
    resolution: rule.resolution ?? null,
    marginPercent: rule.marginPercent,
    marginFlatCents: rule.marginFlatCents,
    currency: rule.currency ?? 'USD',
  }));
  const seoDescription =
    home.meta?.description ??
    'Create AI video with Sora 2, Veo 3.1 and Kling from one workspace. Compare engines side-by-side with the same prompt, then generate instantly.';
  const defaultBadges = ['PAY-AS-YOU-GO', 'PRICE-BEFORE', 'ALWAYS-CURRENT'];
  const badges = Array.isArray(home.badges) && home.badges.length ? home.badges : defaultBadges;
  const hero = home.hero;
  const worksWith = home.worksWith;
  const worksWithBrands = Array.isArray(worksWith.brands) && worksWith.brands.length ? worksWith.brands : WORKS_WITH_BRANDS;
  const heroScreenshot = home.heroScreenshot;
  const defaultWhyCards = [
    { title: 'Live product, not a roadmap.', body: 'Log in and use the same workspace we run internally today.' },
    { title: 'Wallet-first billing.', body: 'Top up once, monitor spend, and get automatic refunds on failed renders.' },
    { title: 'All your engines in one place.', body: 'Switch between Sora, Veo, Pika, MiniMax, and more without juggling dashboards.' },
  ];
  const whyCards = Array.isArray(home.whyCards) && home.whyCards.length ? home.whyCards : defaultWhyCards;
  const ways = home.ways;
  const pricing = home.pricing;
  const trust = home.trust;
  const waysSection = home.waysSection;
  const compareCopy = home.compare ?? null;
  const compareCarouselCopy = {
    ...(compareCopy ?? {}),
    viewModel: dictionary.workspace?.generate?.engineSelect?.modal?.viewModel,
    viewExamples: dictionary.workspace?.generate?.engineSelect?.modal?.viewExamples,
  };
  const homepageSlots = await getHomepageSlotsCached();
  const falEngines = listFalEngines();
  const compareEngineIndex = new Map(falEngines.map((entry) => [entry.modelSlug, entry]));
  const compareEngines = COMPARE_ENGINE_PRIORITY.map((slug) => {
    const entry = compareEngineIndex.get(slug);
    if (!entry) {
      return null;
    }
    return {
      engine: entry,
      meta: COMPARE_ENGINE_META[slug] ?? null,
    };
  })
    .filter(Boolean)
    .map((item) => item as CompareEngineEntry);

  const heroTileConfigs = HERO_SLOT_KEYS.map((key, index) => {
    const slot = homepageSlots.hero.find((entry) => entry.key === key);
    const fallback = HERO_TILES[index] ?? HERO_TILES[0];
    const video = slot?.video ?? null;
    const label = slot?.title || video?.engineLabel || fallback.label;
    const videoSrc = video?.videoUrl ?? fallback.videoSrc;
    const posterSrc = video?.thumbUrl ?? fallback.posterSrc;
    const videoPosterSrc = buildOptimizedPoster(posterSrc);
    const adminPriceLabel = slot?.subtitle?.trim() || null;
    const alt = video?.promptExcerpt || fallback.alt;
    const engineId = normalizeEngineId(video?.engineId ?? fallback.engineId) ?? fallback.engineId;
    const durationSec = video?.durationSec ?? fallback.durationSec;
    const resolution = fallback.resolution;

    const canonicalSlug =
      HERO_TILE_EXAMPLE_SLUGS[engineId] ??
      fallback.examplesSlug ??
      (engineId.includes('/') ? null : engineId);
    const detailHref = video?.id ? `/video/${encodeURIComponent(video.id)}` : null;
    const generateHref = video?.id ? `/app?from=${encodeURIComponent(video.id)}` : null;
    const modelHref = canonicalSlug ? `/models/${encodeURIComponent(canonicalSlug)}` : null;
    const detailMeta = video
      ? {
          prompt: video.promptExcerpt ?? video.prompt ?? null,
          engineLabel: video.engineLabel ?? label,
          durationSec: video.durationSec ?? null,
        }
      : null;

    return {
      id: key,
      label,
      videoSrc,
      posterSrc,
      videoPosterSrc,
      alt,
      showAudioIcon: fallback.showAudioIcon ?? false,
      engineId,
      durationSec,
      resolution,
      fallbackPriceLabel: adminPriceLabel ?? fallback.fallbackPriceLabel,
      minPriceCents: fallback.minPriceCents ?? null,
      minPriceCurrency: fallback.minPriceCurrency ?? 'USD',
      examplesSlug: canonicalSlug,
      detailHref,
      generateHref,
      modelHref,
      detailMeta,
      adminPriceLabel,
    };
  });

  const heroPriceMap: Record<string, string> =
    heroTileConfigs.some((tile) => !tile.adminPriceLabel)
      ? await resolveHeroTilePrices(
          heroTileConfigs
            .filter((tile) => !tile.adminPriceLabel)
            .map((tile) => ({
              id: tile.id,
              engineId: tile.engineId,
              durationSec: tile.durationSec,
              resolution: tile.resolution,
              fallbackPriceLabel: tile.fallbackPriceLabel,
              minPriceCents: tile.minPriceCents,
              minPriceCurrency: tile.minPriceCurrency,
            }))
        )
      : {};

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
    description: seoDescription,
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
    <div>
      <section className="container-page section max-w-6xl stack-gap-lg items-center pt-10 pb-10 text-center sm:pt-12 sm:pb-12 lg:pt-14 lg:pb-14 halo-hero">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {badges.map((badge) => (
            <span key={badge} className="rounded-pill border border-hairline bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-secondary">
              {badge}
            </span>
          ))}
        </div>
        <div className="stack-gap-lg">
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl">{hero.title}</h1>
          <p className="mx-auto sm:max-w-[62ch] text-lg leading-relaxed text-text-secondary">
            {hero.subtitle}
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ButtonLink
            href="/app"
            prefetch={false}
            size="lg"
            className="shadow-card"
            linkComponent={Link}
          >
            {hero.primaryCta}
          </ButtonLink>
          <ButtonLink href={{ pathname: '/examples' }} variant="outline" size="lg" linkComponent={Link}>
            {hero.secondaryCta}
          </ButtonLink>
        </div>
        <div className="grid w-full grid-gap-sm sm:grid-cols-2">
          {heroTileConfigs.map((tile, index) => (
            <HeroMediaTile
              key={tile.id}
              label={tile.label}
              priceLabel={tile.adminPriceLabel ?? heroPriceMap[tile.id] ?? tile.fallbackPriceLabel}
              videoSrc={tile.videoSrc}
              posterSrc={tile.posterSrc}
              videoPosterSrc={tile.videoPosterSrc}
              alt={tile.alt}
              showAudioIcon={tile.showAudioIcon}
              priority={index === 0}
              detailHref={tile.detailHref}
              generateHref={tile.generateHref}
              modelHref={tile.modelHref}
              detailMeta={tile.detailMeta}
              authenticatedHref="/generate"
              guestHref="/login?next=/generate"
              overlayHref={tile.generateHref ?? undefined}
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          <Link href={{ pathname: '/pricing' }} className="underline underline-offset-2">
            Preview pricing
          </Link>
        </p>
      </section>

      <section className="border-t border-hairline bg-surface text-text-secondary section-compact">
        <div className="container-page flex max-w-6xl flex-col items-center gap-4 text-center">
          <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
            {worksWith.label}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6 text-2xl font-semibold text-text-primary sm:text-3xl">
            {worksWithBrands.map((brand) => (
              <span key={brand}>{brand}</span>
            ))}
          </div>
          <p className="text-xs text-text-muted">{worksWith.caption}</p>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section pt-10 pb-6 sm:pt-12 sm:pb-8 lg:pt-16 lg:pb-0 halo-workspace-left">
        <div className="container-page flex max-w-7xl flex-col-reverse items-center gap-[var(--grid-gap-xl)] lg:flex-row lg:items-stretch">
          <div className="w-full sm:max-w-[62ch] stack-gap-lg text-left lg:w-[40%] lg:self-center">
            <h2 className="text-2xl font-semibold text-text-primary sm:text-3xl">{heroScreenshot.title}</h2>
            <p className="text-sm text-text-secondary sm:text-base">{heroScreenshot.body}</p>
          </div>
          <div className="relative w-full max-w-6xl lg:w-[65%] lg:max-w-none lg:self-end mt-2 sm:mt-4 lg:mt-6">
            <div className="overflow-hidden rounded-t-[16px] shadow-float">
              <Image
                src="/assets/marketing/app-dashboard.webp"
                alt={heroScreenshot.alt}
              width={3072}
              height={2170}
                sizes="(min-width: 1280px) 1040px, (min-width: 1024px) 820px, 100vw"
                priority
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-hairline bg-surface section">
        <div className="stack-gap-lg">
          <section id="how-it-works" className="container-page max-w-7xl scroll-mt-32">
            <ProofTabs pricingRules={pricingRulesLite} />
          </section>

          <section className="container-page max-w-6xl">
            <div className="grid grid-gap lg:grid-cols-3">
              {whyCards.map((item) => (
                <article key={item.title} className="rounded-card border border-hairline bg-surface p-6 shadow-card">
                  <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                  <p className="mt-3 text-sm text-text-secondary">{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="border-t border-hairline bg-bg section">
        <ExamplesOrbitCallout
          engines={orbitEngines}
          heading={examplesCalloutCopy.title}
          description={examplesCalloutCopy.subtitle ?? ''}
          ctaLabel={examplesCalloutCopy.cta}
          eyebrow={examplesCalloutCopy.eyebrow}
        />
      </section>

      <section className="border-t border-hairline bg-surface section">
        <CompareEnginesCarousel engines={compareEngines} copy={compareCarouselCopy} />
      </section>

      <section className="border-t border-hairline bg-bg section halo-workspace-bottom">
        <div className="stack-gap-lg">
          <section className="container-page max-w-6xl">
            <div className="mb-6 flex items-center justify-center gap-4">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                  {waysSection.eyebrow}
                </span>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-6xl">
                  {waysSection.title}
                </h2>
                <p className="mt-3 text-sm text-text-secondary sm:text-base">{waysSection.subtitle}</p>
              </div>
            </div>
            <div className="grid grid-gap lg:grid-cols-2">
              {ways.map((item) => (
                <article key={item.title} className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-6 shadow-card">
                  <div>
                    <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">{item.title}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-text-primary">{item.description}</h3>
                  <ul className="space-y-2 text-sm text-text-secondary">
                    {item.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2">
                        <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="container-page max-w-6xl">
            <div className="grid grid-gap lg:grid-cols-[1.2fr_1fr]">
              <article className="rounded-card border border-hairline bg-surface p-6 shadow-card">
                <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {pricing.badge}
                </span>
                <h3 className="mt-4 text-xl font-semibold text-text-primary">{pricing.title}</h3>
                <p className="mt-3 text-sm text-text-secondary">{pricing.body}</p>
                <div className="mt-5">
                  <PriceChip
                    {...DEFAULT_MARKETING_SCENARIO}
                    suffix={home.priceChipSuffix}
                    pricingRules={pricingRulesLite}
                  />
                </div>
                <TextLink href={{ pathname: '/pricing' }} className="mt-6 text-sm" linkComponent={Link}>
                  {pricing.link}
                </TextLink>
                <p className="mt-3 text-sm text-muted-foreground">
                  3,000+ internal test renders · automatic refunds on failures · wallet-first billing
                </p>
              </article>
              <article className="rounded-card border border-hairline bg-surface p-6 shadow-card">
                <span className="rounded-pill border border-hairline px-3 py-1 text-xs font-semibold uppercase tracking-micro text-text-muted">
                  {trust.badge}
                </span>
                <ul className="mt-4 stack-gap-sm text-sm text-text-secondary">
                  {trust.points.map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-text-muted" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>
          </section>
        </div>
      </section>
      <section className="border-t border-hairline bg-surface section">
        <div className="container-page max-w-6xl">
          <div className="rounded-card border border-hairline bg-surface/70 p-6 text-center shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Partners</p>
            <h2 className="mt-2 text-lg font-semibold text-text-primary">Featured on</h2>
            <div className="mt-4 flex justify-center">
              <PartnerBadges className="justify-center opacity-90 transition hover:opacity-100" />
            </div>
          </div>
        </div>
      </section>
      <MiniFAQ faq={home.faq} />
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
              'Independent hub for AI video generation. Price before you generate. Works with Sora, Veo, LTX-2, Kling, Pika, MiniMax, Wan, Nano Banana.',
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
              'Multi-engine routing (Sora, Veo, LTX-2, Kling, Pika, MiniMax, Wan, Nano Banana)',
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
      />    </div>
  );
}
