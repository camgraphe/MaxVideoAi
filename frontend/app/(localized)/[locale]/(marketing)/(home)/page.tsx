import type { Metadata } from 'next';
import Script from 'next/script';
import { getTranslations } from 'next-intl/server';
import { listFalEngines } from '@/config/falEngines';
import compareConfig from '@/config/compare-config.json';
import engineCatalog from '@/config/engine-catalog.json';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { HOMEPAGE_PRICE_PREFIX_BY_LOCALE } from '@/lib/homepage-price-label';
import { resolveDictionary } from '@/lib/i18n/server';
import { localeRegions, type AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { listExampleFamilyPage, listExamples, type GalleryVideo } from '@/server/videos';
import { getHomepageSlotsCached, getSuccessfulGenerationCountCached, type HomepageSlotWithVideo } from '@/server/homepage';
import type { Mode } from '@/types/engines';
import type { HeroVideoShowcaseItem } from '@/components/marketing/home/HeroVideoShowcase';
import {
  AiVideoToolbox,
  ComparisonPreview,
  HomeFaq,
  HomeHero,
  RealExamplesPreview,
  ReferenceWorkflow,
  ShotTypeEngineSelector,
  TransparentPricingBlock,
  WorkflowSeoSummary,
  type ComparisonCard,
  type FaqItem,
  type HomeExampleCard,
  type HomeHeroContent,
  type ProviderItem,
  type ProofStat,
  type ShotTypeCard,
  type ToolCard,
  type TrustCard,
  type WorkflowSeoSummaryCopy,
  type WorkflowStep,
} from '@/components/marketing/home/HomeRedesignSections';

export const revalidate = 60;

type ProofConfig = {
  items: Array<{ id: string; label: string }>;
};

type FallbackExampleCard = {
  id: string;
  title: string;
  engine: string;
  engineId: string;
  modelSlug?: string;
  mode: string;
  duration: string;
  price?: string;
  useCase: string;
  cta: string;
  cloneCta?: string;
  imageSrc: string;
  imageAlt: string;
  examplesSlug?: HomepageExampleFamily;
  showExamplesCta?: boolean;
  modelCta?: string;
};

type ComparisonConfig = {
  id: string;
  slug: string;
  title: string;
  body: string;
  badges: string[];
  imageSrc?: string;
  imageAlt?: string;
};

type ComparisonMediaItem = {
  imageSrc: string;
  imageAlt: string;
  label?: string;
};

type BestForPageConfig = {
  slug: string;
  title: string;
  description?: string;
  tier: number;
  topPicks?: string[];
};

type EngineCatalogEntry = {
  modelSlug: string;
  marketingName: string;
  provider?: string;
  brandId?: string;
};

type BestForCardCopy = {
  slug: string;
  title: string;
  body: string;
  cta: string;
};

type ProviderConfig = ProviderItem & {
  providerKey: string;
};

type RedesignContent = {
  hero: HomeHeroContent;
  proof: ProofConfig;
  shotTypes: {
    title: string;
    subtitle: string;
    eyebrow?: string;
    cta?: string;
    hubCtaTitle?: string;
    hubCtaBody?: string;
    guideLabel?: string;
    topPicksLabel?: string;
    moreGuidesTitle?: string;
    cards: BestForCardCopy[];
  };
  examples: {
    title: string;
    subtitle: string;
    cta: string;
    modelsCta?: string;
    compareLink?: string;
    libraryTitle?: string;
    libraryBody?: string;
    providerLabel?: string;
    viewPrompt: string;
    fallbackCards: FallbackExampleCard[];
  };
  comparisons: {
    title: string;
    subtitle: string;
    cta: string;
    cards: ComparisonConfig[];
  };
  workflow: {
    title: string;
    subtitle: string;
    steps: WorkflowStep[];
  };
  toolbox: {
    title: string;
    subtitle: string;
    primaryCta?: string;
    secondaryCta?: string;
    cards: ToolCard[];
  };
  pricingTrust: {
    title: string;
    subtitle: string;
    cta: string;
    cards: TrustCard[];
  };
  providers: {
    title: string;
    subtitle: string;
    cta: string;
    items: ProviderConfig[];
  };
  faq: {
    title: string;
    subtitle: string;
    items: FaqItem[];
  };
  modeLabels: Partial<Record<Mode | 'unknown', string>>;
};

type EngineStats = {
  total: number;
  providers: number;
  textToVideo: number;
  imageToVideo: number;
  videoToVideo: number;
  audio: number;
  fourK: number;
  extend: number;
  retake: number;
  audioToVideo: number;
};

const EXAMPLE_ENGINE_PRIORITY = [
  'seedance-2-0',
  'kling-3-pro',
  'veo-3-1',
  'veo-3-1-lite',
  'ltx-2-3-pro',
  'happy-horse-1-0',
  'pika-text-to-video',
  'sora-2',
  'ltx-2-3-fast',
  'wan-2-6',
  'kling-3-standard',
] as const;

const BEST_FOR_MAIN_SLUGS = [
  'cinematic-realism',
  'image-to-video',
  'fast-drafts',
  'ads',
] as const;

const BEST_FOR_PAGES = compareConfig.bestForPages as BestForPageConfig[];
const BEST_FOR_BY_SLUG = new Map(BEST_FOR_PAGES.map((entry) => [entry.slug, entry]));
const ENGINE_CATALOG = engineCatalog as EngineCatalogEntry[];
const ENGINE_BY_MODEL_SLUG = new Map(ENGINE_CATALOG.map((entry) => [entry.modelSlug, entry]));

const HOME_ROUTE_MAP = {
  app: '/app',
  imageApp: '/app/image',
  models: { pathname: '/models' },
  examples: { pathname: '/examples' },
  compare: { pathname: '/ai-video-engines' },
  pricing: { pathname: '/pricing' },
  tools: { pathname: '/tools' },
  characterBuilder: { pathname: '/tools/character-builder' },
  angleTool: { pathname: '/tools/angle' },
  upscaleTool: { pathname: '/tools/upscale' },
} satisfies Record<string, LocalizedLinkHref>;

const SUCCESSFUL_GENERATION_PROOF_MINIMUM = 10_000;

const PROVIDER_MODEL_LINKS: Partial<Record<string, LocalizedLinkHref>> = {
  Pika: { pathname: '/models/[slug]', params: { slug: 'pika-text-to-video' } },
  Alibaba: { pathname: '/examples/[model]', params: { model: 'happy-horse' } },
};

const HOMEPAGE_EXAMPLE_FAMILIES = ['seedance', 'kling', 'ltx', 'veo', 'wan', 'happy-horse'] as const;
type HomepageExampleFamily = (typeof HOMEPAGE_EXAMPLE_FAMILIES)[number];

type HeroEngineId = 'seedance-2-0' | 'kling-3-pro' | 'veo-3-1-lite' | 'ltx-2-3-pro' | 'happy-horse-1-0';

const HERO_VIDEO_CHIPS: Record<string, string[]> = {
  'kling-3-pro': ['Cinematic', 'Camera move'],
  'seedance-2-0': ['Cinematic', 'Realism'],
  'veo-3-1-lite': ['Realistic', 'Premium'],
  'ltx-2-3-pro': ['Audio', 'Retake'],
  'happy-horse-1-0': ['Lip-sync', 'Unified'],
};

const HERO_ENGINE_TARGETS: Record<
  HeroEngineId,
  {
    name: string;
    exampleFamily?: HomepageExampleFamily;
    modelSlug: string;
    mode: Mode;
  }
> = {
  'kling-3-pro': { name: 'Kling 3 Pro', exampleFamily: 'kling', modelSlug: 'kling-3-pro', mode: 'i2v' },
  'seedance-2-0': { name: 'Seedance 2.0', exampleFamily: 'seedance', modelSlug: 'seedance-2-0', mode: 'i2v' },
  'veo-3-1-lite': { name: 'Veo 3.1 Lite', exampleFamily: 'veo', modelSlug: 'veo-3-1-lite', mode: 'i2v' },
  'ltx-2-3-pro': { name: 'LTX 2.3 Pro', exampleFamily: 'ltx', modelSlug: 'ltx-2-3-pro', mode: 'a2v' },
  'happy-horse-1-0': { name: 'Happy Horse 1.0', exampleFamily: 'happy-horse', modelSlug: 'happy-horse-1-0', mode: 'ref2v' },
};

const DEFAULT_MODEL_BY_EXAMPLE_FAMILY: Record<HomepageExampleFamily, string> = {
  seedance: 'seedance-2-0',
  kling: 'kling-3-pro',
  ltx: 'ltx-2-3-pro',
  veo: 'veo-3-1',
  wan: 'wan-2-6',
  'happy-horse': 'happy-horse-1-0',
};

const HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES: Partial<Record<string, { videoId?: string; imageSrc?: string }>> = {
  'veo-3-1': {
    videoId: 'job_c36e082d-cd1d-4a25-9f17-02246a878eb9',
  },
  'wan-2-6': {
    videoId: 'job_110f0282-bf5e-4d58-ab34-8b117c94d4e4',
  },
  'happy-horse-1-0': {
    imageSrc:
      'https://videohub-uploads-us.s3.amazonaws.com/rendersthumbs/301cc489-d689-477f-94c4-0b051deda0bc/1212fdd0-0299-4e07-8546-c8fc0925432d.webp',
  },
};

const ALLOWED_TOOL_CARD_IDS = new Set([
  'text-to-video',
  'image-to-video',
  'video-to-video',
  'generate-image',
  'character-builder',
  'angle-tool',
  'upscale',
  'compare-engines',
]);

const FALLBACK_MODE_BY_ENGINE: Record<string, Mode> = {
  'sora-2': 't2v',
  'veo-3-1': 'i2v',
  'veo-3-1-lite': 'i2v',
  'kling-3-pro': 'i2v',
  'kling-3-standard': 't2v',
  'seedance-2-0': 'ref2v',
  'ltx-2-3-fast': 't2v',
  'ltx-2-3-pro': 'a2v',
  'wan-2-6': 'r2v',
  'pika-text-to-video': 't2v',
  'happy-horse-1-0': 'ref2v',
};

function countMode(engines: ReturnType<typeof listFalEngines>, mode: Mode) {
  return engines.filter((entry) => entry.engine.modes.includes(mode)).length;
}

function computeEngineStats(): EngineStats {
  const engines = listFalEngines();
  return {
    total: engines.length,
    providers: new Set(engines.map((entry) => entry.provider)).size,
    textToVideo: countMode(engines, 't2v'),
    imageToVideo: countMode(engines, 'i2v'),
    videoToVideo: countMode(engines, 'v2v'),
    audio: engines.filter((entry) => entry.engine.audio).length,
    fourK: engines.filter((entry) =>
      (entry.engine.resolutions ?? []).some((resolution) => String(resolution).toLowerCase().includes('4k'))
    ).length,
    extend: engines.filter((entry) => entry.engine.extend || entry.engine.modes.includes('extend')).length,
    retake: countMode(engines, 'retake'),
    audioToVideo: countMode(engines, 'a2v'),
  };
}

function resolveProofValue(id: string, stats: EngineStats): string {
  switch (id) {
    case 'engines':
      return String(stats.total);
    case 'providers':
      return String(stats.providers);
    case 'textToVideo':
      return String(stats.textToVideo);
    case 'imageToVideo':
      return String(stats.imageToVideo);
    case 'videoToVideo':
      return String(stats.videoToVideo);
    case 'audio':
      return String(stats.audio);
    case 'fourK':
      return stats.fourK > 0 ? '4K' : '1080p+';
    default:
      return '';
  }
}

function formatProofNumber(locale: AppLocale, value: number): string {
  return new Intl.NumberFormat(localeRegions[locale] ?? 'en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function buildProofStats(content: RedesignContent, stats: EngineStats, locale: AppLocale, successfulGenerationCount: number | null): ProofStat[] {
  const hrefByProofId: Partial<Record<string, LocalizedLinkHref>> = {
    engines: HOME_ROUTE_MAP.models,
    providers: HOME_ROUTE_MAP.models,
    textToVideo: HOME_ROUTE_MAP.models,
    imageToVideo: HOME_ROUTE_MAP.models,
    videoToVideo: HOME_ROUTE_MAP.models,
    audio: HOME_ROUTE_MAP.models,
    fourK: HOME_ROUTE_MAP.models,
    successfulGenerations: HOME_ROUTE_MAP.examples,
  };

  return content.proof.items.flatMap((item) => {
    if (item.id === 'successfulGenerations') {
      if (successfulGenerationCount == null || successfulGenerationCount < SUCCESSFUL_GENERATION_PROOF_MINIMUM) return [];
      return [
        {
          id: item.id,
          value: formatProofNumber(locale, successfulGenerationCount),
          label: item.label,
          href: hrefByProofId[item.id],
        },
      ];
    }

    return [
      {
        id: item.id,
        value: resolveProofValue(item.id, stats),
        label: item.label,
        href: hrefByProofId[item.id],
      },
    ];
  });
}

function buildHeroContent(locale: AppLocale, content: RedesignContent): HomeHeroContent {
  const engines = listFalEngines();
  const engineById = new Map(engines.flatMap((entry) => [[entry.id, entry], [entry.modelSlug, entry]]));

  return {
    ...content.hero,
    mockup: {
      ...content.hero.mockup,
      engineRecommendations: content.hero.mockup.engineRecommendations.map((recommendation) => {
        const engine = engineById.get(recommendation.engineId);
        const linkMeta = buildHeroEngineLinks(locale, recommendation.engineId, recommendation.name);
        const modeLabel = linkMeta.mode ? resolveModeLabel(linkMeta.mode, content) : null;
        const pricing = engine?.pricingHint;
        const formattedPrice =
          pricing && pricing.amountCents > 0
            ? formatStartingPrice(locale, pricing.currency, pricing.amountCents, pricing.durationSeconds)
            : recommendation.fallbackPrice;

        return {
          ...recommendation,
          name: linkMeta.name,
          provider: engine?.provider ?? recommendation.provider,
          price: formattedPrice || recommendation.fallbackPrice,
          modeLabel: modeLabel ?? undefined,
          examplesHref: linkMeta.examplesHref,
          modelHref: linkMeta.modelHref,
          examplesLabel: linkMeta.examplesLabel,
          modelLabel: linkMeta.modelLabel,
        };
      }),
    },
  };
}

function buildBestForGuideCards(content: RedesignContent, slugs: readonly string[]): ShotTypeCard[] {
  const copyBySlug = new Map(content.shotTypes.cards.map((card) => [card.slug, card]));

  return slugs.flatMap((slug) => {
    const entry = BEST_FOR_BY_SLUG.get(slug);
    const localized = copyBySlug.get(slug);
    if (!entry || !localized) return [];

    return [
      {
        id: slug,
        slug,
        title: localized.title,
        body: localized.body || entry.description || '',
        cta: localized.cta,
        href: { pathname: '/ai-video-engines/best-for/[usecase]', params: { usecase: slug } },
        tier: entry.tier,
        topPicks: (entry.topPicks ?? []).slice(0, 3).map((modelSlug) => {
          const engine = ENGINE_BY_MODEL_SLUG.get(modelSlug);
          return {
            slug: modelSlug,
            label: engine?.marketingName ?? modelSlug,
            brandId: engine?.brandId,
            provider: engine?.provider,
          };
        }),
      },
    ];
  });
}

function formatCurrency(locale: AppLocale, currency: string | null | undefined, cents: number | null | undefined) {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return null;
  return new Intl.NumberFormat(localeRegions[locale] ?? 'en-US', {
    style: 'currency',
    currency: currency ?? 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatStartingPrice(
  locale: AppLocale,
  currency: string | null | undefined,
  cents: number | null | undefined,
  durationSeconds?: number | null
) {
  const formatted = formatCurrency(locale, currency, cents);
  if (!formatted) return null;
  const prefix = HOMEPAGE_PRICE_PREFIX_BY_LOCALE[locale] ?? HOMEPAGE_PRICE_PREFIX_BY_LOCALE.en;
  return `${prefix} ${formatted}${durationSeconds ? ` / ${durationSeconds}s` : ''}`;
}

function heroExampleLabel(locale: AppLocale, name: string, family: HomepageExampleFamily) {
  const familyLabel = family === 'ltx' ? 'LTX' : name;
  if (locale === 'fr') return `Voir les exemples ${familyLabel}`;
  if (locale === 'es') return `Ver ejemplos ${familyLabel}`;
  return `View ${familyLabel} examples`;
}

function heroModelLabel() {
  return 'Specs & pricing';
}

function buildHeroEngineLinks(locale: AppLocale, engineId: string, fallbackName: string) {
  const normalizedEngineId = normalizeEngineId(engineId) ?? engineId;
  const target = HERO_ENGINE_TARGETS[normalizedEngineId as HeroEngineId];
  if (!target) {
    const family = resolveExampleCanonicalSlug(normalizedEngineId) as HomepageExampleFamily | null;
    const modelSlug = normalizedEngineId;
    return {
      name: fallbackName,
      modeLabel: null,
      examplesHref: family ? ({ pathname: '/examples/[model]', params: { model: family } } satisfies LocalizedLinkHref) : undefined,
      modelHref: { pathname: '/models/[slug]', params: { slug: modelSlug } } satisfies LocalizedLinkHref,
      examplesLabel: family ? heroExampleLabel(locale, fallbackName, family) : undefined,
      modelLabel: heroModelLabel(),
    };
  }
  return {
    name: target.name,
    modeLabel: null as string | null,
    examplesHref: target.exampleFamily
      ? ({ pathname: '/examples/[model]', params: { model: target.exampleFamily } } satisfies LocalizedLinkHref)
      : undefined,
    modelHref: { pathname: '/models/[slug]', params: { slug: target.modelSlug } } satisfies LocalizedLinkHref,
    examplesLabel: target.exampleFamily ? heroExampleLabel(locale, target.name, target.exampleFamily) : undefined,
    modelLabel: heroModelLabel(),
    mode: target.mode,
  };
}

function formatVideoTime(seconds: number | null | undefined) {
  const safeSeconds = typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 5;
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${remaining}`;
}

function resolveModeLabel(mode: string | null | undefined, content: RedesignContent) {
  const normalized = (mode ?? 'unknown') as Mode | 'unknown';
  return content.modeLabels[normalized] ?? content.modeLabels.unknown ?? 'AI video';
}

function extractMode(video: GalleryVideo): Mode | 'unknown' {
  const settings = video.settingsSnapshot;
  if (settings && typeof settings === 'object' && 'mode' in settings) {
    const mode = (settings as { mode?: unknown }).mode;
    if (typeof mode === 'string') return mode as Mode;
  }
  const canonical = normalizeEngineId(video.engineId) ?? video.engineId;
  return FALLBACK_MODE_BY_ENGINE[canonical] ?? 'unknown';
}

async function loadProgrammedHomepageHeroSlots(): Promise<HomepageSlotWithVideo[]> {
  try {
    const slots = await getHomepageSlotsCached();
    return slots.hero;
  } catch (error) {
    console.warn('[home] failed to load programmed homepage hero slots', error);
    return [];
  }
}

async function loadSuccessfulGenerationCount(): Promise<number | null> {
  try {
    return await getSuccessfulGenerationCountCached();
  } catch (error) {
    console.warn('[home] failed to load successful generation count', error);
    return null;
  }
}

function buildProgrammedHeroItems(
  locale: AppLocale,
  content: RedesignContent,
  slots: HomepageSlotWithVideo[]
): HeroVideoShowcaseItem[] {
  const engines = listFalEngines();
  const engineById = new Map(
    engines.flatMap((entry) => {
      const normalizedId = normalizeEngineId(entry.id) ?? entry.id;
      return [
        [entry.id, entry],
        [entry.modelSlug, entry],
        [normalizedId, entry],
      ] as const;
    })
  );

  return slots
    .filter((slot) => Boolean(slot.video?.thumbUrl || slot.video?.videoUrl))
    .map((slot) => {
      const video = slot.video!;
      const normalizedEngineId = normalizeEngineId(video.engineId) ?? video.engineId;
      const engine = engineById.get(video.engineId) ?? engineById.get(normalizedEngineId);
      const linkMeta = buildHeroEngineLinks(locale, normalizedEngineId, video.engineLabel);
      const durationSeconds = video.durationSec || engine?.pricingHint?.durationSeconds || null;
      const duration = formatVideoTime(durationSeconds);
      const resolution = video.aspectRatio ?? '1080p';
      const mode = resolveModeLabel(linkMeta.mode ?? extractMode(video), content);
      const recommended = content.hero.mockup.engineRecommendations.find((recommendation) => recommendation.engineId === normalizedEngineId);
      const durationLabel = typeof video.durationSec === 'number' ? `${video.durationSec}s` : `${Number(duration.replace(/^0:/, ''))}s`;
      const mediaInfo = [mode, durationLabel, video.aspectRatio ?? null].filter(Boolean).join(' · ');
      const chips = HERO_VIDEO_CHIPS[normalizedEngineId] ?? (recommended?.bestFor ? [recommended.bestFor] : [mode]);
      const startingPrice =
        (engine?.pricingHint
          ? formatStartingPrice(locale, engine.pricingHint.currency, engine.pricingHint.amountCents, engine.pricingHint.durationSeconds)
          : null) ??
        formatStartingPrice(locale, video.currency, video.finalPriceCents, video.durationSec) ??
        content.hero.mockup.engineRecommendations.find((recommendation) => recommendation.engineId === normalizedEngineId)?.fallbackPrice ??
        content.hero.mockup.quoteValue;
      const finalQuote = formatCurrency(locale, video.currency, video.finalPriceCents);

      return {
        id: `programmed-${slot.key}-${video.id}`,
        engineId: normalizedEngineId,
        name: linkMeta.name,
        provider: engine?.provider ?? video.engineLabel,
        bestFor: chips[0] ?? mode,
        chips,
        mediaInfo,
        price: startingPrice,
        estimateLabel: content.hero.mockup.quoteLabel,
        estimateValue: finalQuote ?? startingPrice,
        estimateMeta: typeof video.durationSec === 'number' ? `${video.durationSec}s generation` : `${duration} generation`,
        examplesHref: linkMeta.examplesHref,
        modelHref: linkMeta.modelHref,
        examplesLabel: linkMeta.examplesLabel,
        modelLabel: linkMeta.modelLabel,
        posterSrc: video.thumbUrl ?? '/assets/placeholders/preview-16x9.png',
        videoSrc: video.videoUrl ?? null,
        duration,
        resolution,
        imageAlt: `${video.engineLabel} AI video programmed for the MaxVideoAI homepage.`,
      };
    });
}

function sortExamplesByPriority(videos: GalleryVideo[]) {
  const priority = new Map<string, number>(EXAMPLE_ENGINE_PRIORITY.map((id, index) => [id, index]));
  return [...videos].sort((left, right) => {
    const leftId = normalizeEngineId(left.engineId) ?? left.engineId;
    const rightId = normalizeEngineId(right.engineId) ?? right.engineId;
    return (priority.get(leftId) ?? 99) - (priority.get(rightId) ?? 99);
  });
}

function preferHomepageExampleVideo(
  videos: GalleryVideo[],
  targetEngineId: string,
  family: HomepageExampleFamily | undefined,
  preferredVideoId?: string
): GalleryVideo | null {
  const normalizedTarget = normalizeEngineId(targetEngineId) ?? targetEngineId;
  const usable = videos.filter((video) => {
    if (!video.thumbUrl) return false;
    const engineId = normalizeEngineId(video.engineId) ?? video.engineId;
    if (engineId === normalizedTarget) return true;
    return family ? resolveExampleCanonicalSlug(engineId) === family : false;
  });
  const preferred = preferredVideoId ? usable.find((video) => video.id === preferredVideoId && video.aspectRatio === '16:9') : null;
  if (preferred) return preferred;
  const exactEngine = usable.filter((video) => (normalizeEngineId(video.engineId) ?? video.engineId) === normalizedTarget);
  const exact16x9 = exactEngine.find((video) => video.aspectRatio === '16:9');
  if (exact16x9) return exact16x9;
  const family16x9 = usable.find((video) => video.aspectRatio === '16:9');
  return exactEngine[0] ?? family16x9 ?? usable[0] ?? null;
}

function formatHomepageExampleDuration(locale: AppLocale, video: GalleryVideo | null, fallback: string): string {
  if (typeof video?.durationSec === 'number' && Number.isFinite(video.durationSec) && video.durationSec > 0) {
    return locale === 'fr' ? `${video.durationSec} s` : `${video.durationSec}s`;
  }
  return fallback;
}

function formatHomepageExamplePrice(locale: AppLocale, video: GalleryVideo | null, fallback?: string): string | null {
  return formatCurrency(locale, video?.currency, video?.finalPriceCents) ?? fallback ?? null;
}

async function loadHomepageExamples(locale: AppLocale, content: RedesignContent): Promise<HomeExampleCard[]> {
  const [latestVideos, playlistVideos, familyPools] = await Promise.all([
    listExamples('date-desc', 120).catch(() => [] as GalleryVideo[]),
    listExamples('playlist', 120).catch(() => [] as GalleryVideo[]),
    Promise.all(
      HOMEPAGE_EXAMPLE_FAMILIES.map(async (family) => {
        const result = await listExampleFamilyPage(family, { sort: 'date-desc', limit: 24, offset: 0 }).catch(() => ({
          items: [] as GalleryVideo[],
          total: 0,
          limit: 24,
          offset: 0,
          hasMore: false,
        }));
        return [family, result.items] as const;
      })
    ),
  ]);
  const familyVideos = new Map(familyPools);
  const globalCandidates = [...latestVideos, ...sortExamplesByPriority(playlistVideos)];

  return content.examples.fallbackCards.flatMap<HomeExampleCard>((fallback) => {
    const family = fallback.examplesSlug;
    const familyCandidates = family ? familyVideos.get(family) ?? [] : [];
    const override = HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES[fallback.engineId];
    const video = preferHomepageExampleVideo([...globalCandidates, ...familyCandidates], fallback.engineId, family, override?.videoId);
    const engineId = video ? normalizeEngineId(video.engineId) ?? video.engineId : fallback.engineId;
    const modelSlug = fallback.modelSlug ?? (family ? DEFAULT_MODEL_BY_EXAMPLE_FAMILY[family] : fallback.engineId);
    const href = family
      ? ({ pathname: '/examples/[model]', params: { model: family } } satisfies LocalizedLinkHref)
      : ({ pathname: '/models/[slug]', params: { slug: modelSlug } } satisfies LocalizedLinkHref);

    return [
      {
        id: fallback.id,
        title: fallback.title,
        engineId,
        engine: fallback.engine,
        mode: fallback.mode,
        duration: formatHomepageExampleDuration(locale, video, fallback.duration),
        price: formatHomepageExamplePrice(locale, video, fallback.price),
        useCase: fallback.useCase,
        imageSrc: override?.imageSrc ?? video?.thumbUrl ?? fallback.imageSrc,
        videoSrc: null,
        imageAlt: fallback.imageAlt,
        href,
        modelHref: family ? ({ pathname: '/models/[slug]', params: { slug: modelSlug } } satisfies LocalizedLinkHref) : undefined,
        cloneHref: undefined,
        ctaLabel: fallback.cta,
        examplesCtaVisible: fallback.showExamplesCta !== false,
        modelCtaLabel: fallback.modelCta,
        cloneLabel: fallback.cloneCta ?? content.examples.viewPrompt,
      },
    ];
  });
}

function splitComparisonSlug(slug: string): [string, string] | null {
  const [left, right] = slug.split('-vs-');
  if (!left || !right) return null;
  return [left, right];
}

function resolveComparisonEngineLabel(slug: string): string {
  return ENGINE_BY_MODEL_SLUG.get(slug)?.marketingName ?? slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function compactComparisonLabel(label: string): string {
  return label
    .replace(/^Google\s+/i, '')
    .replace(/^LTX Video 2\.0 Pro$/i, 'LTX 2')
    .replace(/\s+Text to Video$/i, '')
    .trim();
}

async function loadComparisonExamplePools(
  cards: ComparisonConfig[],
  usedImageSrcs: Set<string>
): Promise<Map<HomepageExampleFamily, GalleryVideo[]>> {
  const families = new Set<HomepageExampleFamily>();

  cards.forEach((card) => {
    const pair = splitComparisonSlug(card.slug);
    if (!pair) return;
    pair.forEach((engineSlug) => {
      const family = resolveExampleCanonicalSlug(engineSlug);
      if (family && HOMEPAGE_EXAMPLE_FAMILIES.includes(family as HomepageExampleFamily)) {
        families.add(family as HomepageExampleFamily);
      }
    });
  });

  const entries = await Promise.all(
    Array.from(families).map(async (family) => {
      const result = await listExampleFamilyPage(family, { sort: 'playlist', limit: 14, offset: 0 }).catch((error) => {
        console.warn(`[home] failed to load comparison thumbnails for "${family}"`, error);
        return { items: [] as GalleryVideo[] };
      });
      const videos = result.items.filter((video) => video.thumbUrl && !usedImageSrcs.has(video.thumbUrl));
      return [family, videos] as const;
    })
  );

  return new Map(entries);
}

function takeComparisonMediaFromFamily(
  pool: GalleryVideo[],
  usedImageSrcs: Set<string>,
  label: string,
  title: string
): ComparisonMediaItem | null {
  const video = pool.find((candidate) => candidate.thumbUrl && !usedImageSrcs.has(candidate.thumbUrl));
  if (!video?.thumbUrl) return null;
  usedImageSrcs.add(video.thumbUrl);
  return {
    imageSrc: video.thumbUrl,
    imageAlt: `${label} example thumbnail used in the ${title} comparison card.`,
    label: compactComparisonLabel(label),
  };
}

async function buildComparisonCardsWithExampleMedia(
  content: RedesignContent,
  homepageExamples: HomeExampleCard[]
): Promise<ComparisonCard[]> {
  const publishedCards = content.comparisons.cards.filter((card) => isPublishedComparisonSlug(card.slug));
  const usedImageSrcs = new Set(
    homepageExamples
      .map((example) => example.imageSrc)
      .filter((imageSrc): imageSrc is string => Boolean(imageSrc) && !imageSrc.startsWith('/assets/placeholders/'))
  );
  const pools = await loadComparisonExamplePools(publishedCards, usedImageSrcs);

  return content.comparisons.cards
    .filter((card) => isPublishedComparisonSlug(card.slug))
    .map((card) => {
      const pair = splitComparisonSlug(card.slug);
      const media = pair?.flatMap((engineSlug) => {
        const family = resolveExampleCanonicalSlug(engineSlug) as HomepageExampleFamily | null;
        if (!family || !HOMEPAGE_EXAMPLE_FAMILIES.includes(family)) return [];
        const label = resolveComparisonEngineLabel(engineSlug);
        const item = takeComparisonMediaFromFamily(pools.get(family) ?? [], usedImageSrcs, label, card.title);
        return item ? [item] : [];
      });

      return {
        id: card.id,
        title: card.title,
        body: card.body,
        badges: card.badges,
        cta: content.comparisons.cta,
        href: { pathname: '/ai-video-engines/[slug]', params: { slug: card.slug } },
        imageSrc: card.imageSrc,
        imageAlt: card.imageAlt,
        media: media && media.length >= 2 ? media : undefined,
      };
    });
}

function filterProviderItems(content: RedesignContent): ProviderItem[] {
  const providers = new Set(listFalEngines().map((entry) => entry.provider.toLowerCase()));
  return content.providers.items
    .filter((item) => providers.has(item.providerKey.toLowerCase()))
    .map(({ provider, model, href, providerKey }) => ({
      provider,
      model,
      href: href ?? PROVIDER_MODEL_LINKS[providerKey],
    }));
}

function filterToolCards(content: RedesignContent, stats: EngineStats): ToolCard[] {
  return content.toolbox.cards.filter((tool) => {
    if (!ALLOWED_TOOL_CARD_IDS.has(tool.id)) return false;
    if (tool.id === 'extend-video') return stats.extend > 0;
    if (tool.id === 'retake') return stats.retake > 0;
    if (tool.id === 'audio-to-video') return stats.audioToVideo > 0 || stats.audio > 0;
    if (tool.id === 'video-to-video') return stats.videoToVideo > 0;
    return true;
  });
}

function buildSoftwareSchema(content: RedesignContent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MaxVideoAI',
    applicationCategory: 'VideoEditorApplication',
    operatingSystem: 'Web',
    url: 'https://maxvideoai.com',
    description: content.hero.subtitle,
    offers: {
      '@type': 'Offer',
      price: '10.00',
      priceCurrency: 'USD',
      description: content.pricingTrust.subtitle,
    },
    featureList: [
      'Pay-as-you-go multi-engine AI video generation workspace',
      'Compare AI video models before generating',
      'Live price before you generate',
      'Text-to-video, image-to-video, video-to-video and reference workflows',
      'Auto-refunds on failed generation jobs',
    ],
  };
}

function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MaxVideo AI',
    url: 'https://maxvideoai.com',
    logo: 'https://maxvideoai.com/favicon-512.png',
    sameAs: [],
    description:
      'Independent hub for AI video generation. Price before you generate. Works with Seedance, Kling, Veo, LTX, Wan, Pika, Sora and more.',
  };
}

function buildFaqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function buildItemListSchema(content: RedesignContent, providers: ProviderItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: content.providers.title,
    itemListElement: providers.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${item.provider} ${item.model}`,
    })),
  };
}

export async function generateMetadata({ params }: { params: { locale: AppLocale } }): Promise<Metadata> {
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'home.meta' });
  return buildSeoMetadata({
    locale,
    title: t('title'),
    description: t('description'),
    hreflangGroup: 'home',
    image: '/og/home-hub.png',
    imageAlt: t('title'),
  });
}

export default async function HomePage({ params }: { params: { locale: AppLocale } }) {
  const locale = params.locale;
  const { dictionary } = await resolveDictionary({ locale });
  const content = dictionary.home.redesign as RedesignContent;
  const workflowSeoCopy = dictionary.home.seoContent as WorkflowSeoSummaryCopy | undefined;
  const startupFameLabel = dictionary.home.partners?.startupFameLabel ?? 'Featured on Startup Fame';
  const stats = computeEngineStats();
  const hero = buildHeroContent(locale, content);
  const [examples, programmedHeroSlots, successfulGenerationCount] = await Promise.all([
    loadHomepageExamples(locale, content),
    loadProgrammedHomepageHeroSlots(),
    loadSuccessfulGenerationCount(),
  ]);
  const proofStats = buildProofStats(content, stats, locale, successfulGenerationCount);
  const programmedHeroItems = buildProgrammedHeroItems(locale, content, programmedHeroSlots);
  const primaryBestForCards = buildBestForGuideCards(content, BEST_FOR_MAIN_SLUGS);
  const comparisons = await buildComparisonCardsWithExampleMedia(content, examples);
  const providers = filterProviderItems(content);
  const tools = filterToolCards(content, stats);
  const softwareSchema = buildSoftwareSchema(content);
  const organizationSchema = buildOrganizationSchema();
  const faqSchema = buildFaqSchema(content.faq.items);
  const itemListSchema = buildItemListSchema(content, providers);

  return (
    <div className="home-monochrome">
      <HomeHero copy={hero} proofStats={proofStats} previews={examples.slice(0, 5)} programmedHeroItems={programmedHeroItems} />
      <ShotTypeEngineSelector copy={content.shotTypes} cards={primaryBestForCards} startupFameLabel={startupFameLabel} />
      <RealExamplesPreview copy={content.examples} examples={examples} providers={providers} />
      <ComparisonPreview copy={content.comparisons} comparisons={comparisons} />
      <ReferenceWorkflow copy={content.workflow} steps={content.workflow.steps} />
      <AiVideoToolbox copy={content.toolbox} tools={tools} />
      <TransparentPricingBlock copy={content.pricingTrust} cards={content.pricingTrust.cards} />
      {workflowSeoCopy ? <WorkflowSeoSummary copy={workflowSeoCopy} /> : null}
      <HomeFaq copy={content.faq} items={content.faq.items} />
      <Script id="home-webapp-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="home-organization-jsonld" type="application/ld+json">
        {JSON.stringify(organizationSchema)}
      </Script>
      <script id="home-faq-jsonld" type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqSchema) }} />
      <Script id="home-provider-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListSchema)}
      </Script>
    </div>
  );
}
