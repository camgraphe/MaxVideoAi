import Image from 'next/image';
import { Suspense } from 'react';
import { Link } from '@/i18n/navigation';
import { ButtonLink } from '@/components/ui/Button';
import { HomeHeroSecondaryLinks } from './HomeHeroSecondaryLinks';
import { HeroVideoShowcase, HeroVideoPriceQuote, type HeroVideoShowcaseItem, type HeroVideoPriceSlots } from '@/components/marketing/home/HeroVideoShowcase';
import {
  HERO_ENGINE_MEDIA,
  HERO_VIDEO_CHIPS,
  HERO_VIDEO_MODE_LABELS,
  HERO_VIDEO_ORDER,
} from '@/components/marketing/home/home-redesign-visuals';
import { HOME_LCP_POSTER_SRC } from '@/components/marketing/home/home-lcp-image';
import type { HomeExampleCard, HomeHeroContent } from '@/components/marketing/home/home-redesign-types';
import type { CurrentExamplePrice } from '@/server/current-example-price';
import type { AppLocale } from '@/i18n/locales';
import { formatCurrentExampleAmount, formatCurrentExampleScenario } from '@/lib/current-example-price-display';

function buildHeroVideoItems(copy: HomeHeroContent['mockup']): HeroVideoShowcaseItem[] {
  const orderedEngines = [...copy.engineRecommendations].sort((left, right) => {
    if (left.selected) return -1;
    if (right.selected) return 1;
    return 0;
  });

  return orderedEngines.map((engine) => {
    const fallbackMedia = HERO_ENGINE_MEDIA[engine.engineId] ?? HERO_ENGINE_MEDIA['kling-3-pro'];
    const engineName = engine.engineId === 'kling-3-pro' ? 'Kling 3 Pro' : engine.name;
    const durationLabel = fallbackMedia.duration.startsWith('0:')
      ? `${Number(fallbackMedia.duration.slice(2))}s`
      : fallbackMedia.duration;

    return {
      id: engine.engineId,
      engineId: engine.engineId,
      name: engineName,
      provider: engine.provider,
      bestFor: engine.bestFor,
      chips: engine.tags?.length ? engine.tags.slice(0, 2) : (HERO_VIDEO_CHIPS[engine.engineId] ?? [engine.bestFor, engine.provider]),
      mediaInfo: [engine.modeLabel ?? HERO_VIDEO_MODE_LABELS[engine.engineId], durationLabel, fallbackMedia.resolution].filter(Boolean).join(' · '),
      price: fallbackMedia.price ?? engine.price ?? engine.fallbackPrice,
      estimateLabel: copy.quoteLabel,
      estimateValue: fallbackMedia.estimateValue ?? copy.quoteValue,
      estimateMeta: fallbackMedia.estimateMeta ?? '5s generation',
      examplesHref: engine.examplesHref,
      modelHref: engine.modelHref,
      examplesLabel: engine.examplesLabel,
      modelLabel: engine.modelLabel,
      posterSrc: fallbackMedia.posterSrc,
      videoSrc: fallbackMedia.videoSrc ?? null,
      duration: fallbackMedia.duration,
      resolution: fallbackMedia.resolution,
      imageAlt: engine.imageAlt ?? `${engineName} AI video preview in MaxVideoAI.`,
    };
  });
}

function applyCuratedHeroMedia(item: HeroVideoShowcaseItem): HeroVideoShowcaseItem {
  const engineId = item.engineId ?? item.id;
  const media = HERO_ENGINE_MEDIA[engineId];
  if (!media) return item;

  const modeLabel = item.mediaInfo?.split(' · ')[0] ?? HERO_VIDEO_MODE_LABELS[engineId];
  const durationLabel = media.duration.startsWith('0:') ? `${Number(media.duration.slice(2))}s` : media.duration;

  return {
    ...item,
    chips: media.chips ?? item.chips,
    posterSrc: media.posterSrc,
    videoSrc: media.videoSrc ?? null,
    duration: media.duration,
    resolution: media.resolution,
    mediaInfo: [modeLabel, durationLabel, media.resolution].filter(Boolean).join(' · '),
    estimateValue: media.estimateValue ?? item.estimateValue,
    estimateMeta: media.estimateMeta ?? item.estimateMeta,
    imageAlt: media.imageAlt ?? `${item.name} AI video preview in MaxVideoAI.`,
  };
}

function applyHomeLcpPoster(item: HeroVideoShowcaseItem): HeroVideoShowcaseItem {
  const engineId = item.engineId ?? item.id;
  if (engineId === HERO_VIDEO_ORDER[0]) {
    return { ...item, posterSrc: HOME_LCP_POSTER_SRC, unoptimizedPoster: true };
  }
  return item;
}

function applyCurrentHeroPrice(item: HeroVideoShowcaseItem, prices: ReadonlyMap<string, CurrentExamplePrice>, locale: AppLocale): HeroVideoShowcaseItem {
  const currentPrice = prices.get(item.engineId ?? item.id);
  const amount = currentPrice ? formatCurrentExampleAmount(currentPrice, locale) : null;
  const quoteScenario = currentPrice ? formatCurrentExampleScenario(currentPrice, locale) : null;
  return {
    ...item,
    price: amount ?? '',
    estimateValue: amount ?? (locale === 'fr' ? 'Indisponible' : locale === 'es' ? 'No disponible' : 'Unavailable'),
    estimateLabel: currentPrice?.kind === 'reference'
      ? (locale === 'fr' ? 'Tarif actuel dès' : locale === 'es' ? 'Precio actual desde' : 'Current price from')
      : currentPrice?.kind === 'exact'
        ? (locale === 'fr' ? 'Prix actuel' : locale === 'es' ? 'Precio actual' : 'Current price')
        : (locale === 'fr' ? 'Tarif actuel' : locale === 'es' ? 'Precio actual' : 'Current price'),
    quoteScenario: quoteScenario ?? undefined,
    priceKind: currentPrice?.kind ?? 'unavailable',
    priceNote: undefined,
  };
}

async function ResolvedHeroPrice({ item, prices, locale, details }: {
  item: HeroVideoShowcaseItem; prices: Promise<ReadonlyMap<string, CurrentExamplePrice>>; locale: AppLocale; details?: boolean;
}) {
  return <HeroVideoPriceQuote selected={applyCurrentHeroPrice(item, await prices, locale)} details={details} />;
}

export function HomeHero({
  copy,
  programmedHeroItems = [],
  currentHeroPrices,
  currentHeroPricesPending,
  locale = 'en',
}: {
  copy: HomeHeroContent;
  previews?: HomeExampleCard[];
  programmedHeroItems?: HeroVideoShowcaseItem[];
  currentHeroPrices?: ReadonlyMap<string, CurrentExamplePrice>;
  currentHeroPricesPending?: Promise<ReadonlyMap<string, CurrentExamplePrice>>;
  locale?: AppLocale;
}) {
  const fallbackItems = buildHeroVideoItems(copy.mockup);
  const programmedByEngine = new Map<string, HeroVideoShowcaseItem>();
  programmedHeroItems.forEach((item) => {
    const engineId = item.engineId ?? item.id;
    if (HERO_VIDEO_ORDER.includes(engineId as (typeof HERO_VIDEO_ORDER)[number]) && !programmedByEngine.has(engineId)) {
      programmedByEngine.set(engineId, item);
    }
  });
  const fallbackByEngine = new Map(fallbackItems.map((item) => [item.engineId ?? item.id, item]));
  const videoItems = HERO_VIDEO_ORDER.flatMap((engineId) => {
    const localizedFallback = fallbackByEngine.get(engineId);
    const item = programmedByEngine.get(engineId) ?? localizedFallback;
    if (!item) return [];

    const curatedItem = applyCuratedHeroMedia(item);
    const localizedItem = localizedFallback
      ? {
          ...curatedItem,
          bestFor: localizedFallback.bestFor,
          chips: localizedFallback.chips,
          imageAlt: localizedFallback.imageAlt,
        }
      : curatedItem;

    const currentItem = currentHeroPrices ? applyCurrentHeroPrice(localizedItem, currentHeroPrices, locale) : localizedItem;
    return [applyHomeLcpPoster(currentItem)];
  });
  // Stream only price content: the player and its media identity remain in the initial shell.
  const priceQuotes: HeroVideoPriceSlots | undefined = currentHeroPricesPending
    ? Object.fromEntries(videoItems.map(item => {
        const pendingItem = { ...item, price: '', estimateValue: '—', priceKind: 'unavailable' as const,
          estimateLabel: locale === 'fr' ? 'Chargement du prix…' : locale === 'es' ? 'Cargando precio…' : 'Loading price…' };
        return [item.id, {
          badge: <Suspense fallback={<HeroVideoPriceQuote selected={pendingItem} />}><ResolvedHeroPrice item={item} prices={currentHeroPricesPending} locale={locale} /></Suspense>,
          details: <Suspense fallback={<HeroVideoPriceQuote selected={pendingItem} details />}><ResolvedHeroPrice item={item} prices={currentHeroPricesPending} locale={locale} details /></Suspense>,
        }];
      }))
    : undefined;
  return (
    <section className="home-hero-section cinema-opening">
      <div className="container-page cinema-opening-grid">
        <div className="cinema-opening-copy">
          <p className="mb-5 text-xs uppercase tracking-micro text-text-muted">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="mt-5 text-base leading-7 text-text-secondary lg:text-lg">{copy.subtitle}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/app" prefetch={false} linkComponent={Link} size="lg" data-analytics-event="hero_start_render_click" data-analytics-cta-name="start_render" data-analytics-cta-location="home_hero">{copy.primaryCta}<span aria-hidden>↗</span></ButtonLink>
            <ButtonLink href={{ pathname: '/examples' }} prefetch={false} linkComponent={Link} size="lg" variant="outline" data-analytics-event="hero_examples_click" data-analytics-cta-name="see_examples" data-analytics-cta-location="home_hero" data-analytics-target-family="examples">{copy.secondaryCta}</ButtonLink>
          </div>
        </div>
        <div className="cinema-opening-stage">
          <HeroVideoShowcase items={videoItems} priceQuotes={priceQuotes}
            playLabel={copy.mockup.playLabel} pauseLabel={copy.mockup.pauseLabel}
            loadingLabel={copy.mockup.loadingLabel} errorLabel={copy.mockup.errorLabel} retryLabel={copy.mockup.retryLabel} fullscreenLabel={copy.mockup.fullscreenLabel}
            soundOnLabel={copy.mockup.soundOnLabel} soundOffLabel={copy.mockup.soundOffLabel} progressLabel={copy.mockup.progressLabel}
          />
        </div>
        <HomeHeroSecondaryLinks compareLabel={copy.examplesCta} trustBadges={copy.trustBadges ?? []} />
      </div>
      <div id="model-brands" className="container-page cinema-models">
        <div className="cinema-model-marks">{[
          ['kling-3-pro','Kling','/brand/partners/kling/kling-mark-light.png'],
          ['seedance-2-5','Seedance','/brand/partners/bytedance/bytedance-mark-light.svg'],
          ['minimax-h3-max','MiniMax','/brand/partners/minimax/minimax-mark-light.svg'],
          ['wan-3-prime','Wan','/brand/partners/wan/wan-mark-light.png'],
          ['ltx-2-5-pro','LTX','/brand/partners/lightricks/lightricks-mark-light.png'],
          ['veo-3-1','Veo','/brand/partners/google/google-mark-light.svg'],
          ['happy-horse-1-1','Happy Horse','/brand/partners/alibaba/alibaba-icon.png'],
          ['grok-imagine-video-1-5','Grok','/brand/partners/xai/grok-app-icon.png'],
          ['luma-ray-3-2','Luma','/brand/partners/luma/luma-mark-light.png'],
          ['pika-text-to-video','Pika','/brand/partners/pika/pika-mark-light.png'],
        ].map(([slug,label,src])=><Link key={slug} href={{pathname:'/models/[slug]',params:{slug}}} prefetch={false}><Image src={src} alt="" aria-hidden="true" width={30} height={24}/><span>{label}</span></Link>)}</div>
      </div>
    </section>
  );
}
