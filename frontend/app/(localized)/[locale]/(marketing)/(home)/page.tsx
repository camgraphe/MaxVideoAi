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
import { listExamples, type GalleryVideo } from '@/server/videos';
import { getHomepageSlotsCached, type HomepageSlotWithVideo } from '@/server/homepage';
import type { Mode } from '@/types/engines';
import type { HeroVideoShowcaseItem } from '@/components/marketing/home/HeroVideoShowcase';
import {
  AiVideoToolbox,
  ComparisonPreview,
  HomeFaq,
  HomeHero,
  RealExamplesPreview,
  ReferenceWorkflow,
  SeoKeywordBlock,
  ShotTypeEngineSelector,
  TransparentPricingBlock,
  type ComparisonCard,
  type FaqItem,
  type HomeExampleCard,
  type HomeHeroContent,
  type ProviderItem,
  type ProofStat,
  type ShotTypeCard,
  type ToolCard,
  type TrustCard,
  type WorkflowStep,
} from '@/components/marketing/home/HomeRedesignSections';

export const revalidate = 60;

type ProofConfig = {
  liveValue: string;
  pricingSubLabel?: string;
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
  seoKeywordBlock: string;
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
  'ltx-2-3-fast',
  'wan-2-6',
  'pika-text-to-video',
  'sora-2',
  'ltx-2-3-pro',
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

const PROVIDER_MODEL_LINKS: Partial<Record<string, LocalizedLinkHref>> = {
  Pika: { pathname: '/models/[slug]', params: { slug: 'pika-text-to-video' } },
};

const HOMEPAGE_EXAMPLE_FAMILIES = ['seedance', 'kling', 'ltx', 'veo', 'wan'] as const;
type HomepageExampleFamily = (typeof HOMEPAGE_EXAMPLE_FAMILIES)[number];

type HeroEngineId = 'seedance-2-0' | 'kling-3-pro' | 'veo-3-1-lite' | 'ltx-2-3-fast' | 'wan-2-6';

const HERO_VIDEO_CHIPS: Record<string, string[]> = {
  'kling-3-pro': ['Cinematic', 'Camera move'],
  'seedance-2-0': ['Cinematic', 'Realism'],
  'veo-3-1-lite': ['Realistic', 'Premium'],
  'ltx-2-3-fast': ['Fast draft', 'Low cost'],
  'wan-2-6': ['Video-to-video', 'Structured'],
};

const HERO_ENGINE_TARGETS: Record<
  HeroEngineId,
  {
    name: string;
    exampleFamily: HomepageExampleFamily;
    modelSlug: string;
    mode: Mode;
  }
> = {
  'kling-3-pro': { name: 'Kling 3 Pro', exampleFamily: 'kling', modelSlug: 'kling-3-pro', mode: 'i2v' },
  'seedance-2-0': { name: 'Seedance 2.0', exampleFamily: 'seedance', modelSlug: 'seedance-2-0', mode: 'i2v' },
  'veo-3-1-lite': { name: 'Veo 3.1 Lite', exampleFamily: 'veo', modelSlug: 'veo-3-1-lite', mode: 'i2v' },
  'ltx-2-3-fast': { name: 'LTX 2.3 Fast', exampleFamily: 'ltx', modelSlug: 'ltx-2-3-fast', mode: 't2v' },
  'wan-2-6': { name: 'Wan 2.6', exampleFamily: 'wan', modelSlug: 'wan-2-6', mode: 'v2v' },
};

const DEFAULT_MODEL_BY_EXAMPLE_FAMILY: Record<HomepageExampleFamily, string> = {
  seedance: 'seedance-2-0',
  kling: 'kling-3-pro',
  ltx: 'ltx-2-3-fast',
  veo: 'veo-3-1',
  wan: 'wan-2-6',
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

function resolveProofValue(id: string, stats: EngineStats, proof: ProofConfig): string {
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
    case 'pricing':
      return proof.liveValue;
    default:
      return '';
  }
}

function buildProofStats(content: RedesignContent, stats: EngineStats): ProofStat[] {
  const hrefByProofId: Partial<Record<string, LocalizedLinkHref>> = {
    engines: HOME_ROUTE_MAP.models,
    providers: HOME_ROUTE_MAP.models,
    textToVideo: HOME_ROUTE_MAP.models,
    imageToVideo: HOME_ROUTE_MAP.models,
    videoToVideo: HOME_ROUTE_MAP.models,
    pricing: HOME_ROUTE_MAP.pricing,
  };

  return content.proof.items.map((item) => ({
    id: item.id,
    value: item.id === 'pricing' ? item.label : resolveProofValue(item.id, stats, content.proof),
    label: item.id === 'pricing' ? content.proof.pricingSubLabel ?? 'Before you generate' : item.label,
    href: hrefByProofId[item.id],
  }));
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

function heroModelLabel(locale: AppLocale, name: string) {
  if (locale === 'fr') return `Ouvrir le modèle ${name}`;
  if (locale === 'es') return `Abrir modelo ${name}`;
  return `Open ${name} model`;
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
      modelLabel: heroModelLabel(locale, fallbackName),
    };
  }
  return {
    name: target.name,
    modeLabel: null as string | null,
    examplesHref: { pathname: '/examples/[model]', params: { model: target.exampleFamily } } satisfies LocalizedLinkHref,
    modelHref: { pathname: '/models/[slug]', params: { slug: target.modelSlug } } satisfies LocalizedLinkHref,
    examplesLabel: heroExampleLabel(locale, target.name, target.exampleFamily),
    modelLabel: heroModelLabel(locale, target.name),
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

async function loadHomepageExamples(locale: AppLocale, content: RedesignContent): Promise<HomeExampleCard[]> {
  const videos = await listExamples('playlist', 40).catch(() => [] as GalleryVideo[]);
  const realByFamily = new Map<HomepageExampleFamily, GalleryVideo>();

  sortExamplesByPriority(videos).forEach((video) => {
    if (!video.thumbUrl) return;
    const engineId = normalizeEngineId(video.engineId) ?? video.engineId;
    const family = resolveExampleCanonicalSlug(engineId);
    if (!family || !HOMEPAGE_EXAMPLE_FAMILIES.includes(family as HomepageExampleFamily)) return;
    const typedFamily = family as HomepageExampleFamily;
    if (!realByFamily.has(typedFamily)) {
      realByFamily.set(typedFamily, video);
    }
  });

  return content.examples.fallbackCards.flatMap<HomeExampleCard>((fallback) => {
    const family = fallback.examplesSlug;
    const video = family ? realByFamily.get(family) : null;
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
        duration: fallback.duration,
        price: fallback.price ?? null,
        useCase: fallback.useCase,
        imageSrc: video?.thumbUrl ?? fallback.imageSrc,
        videoSrc: null,
        imageAlt: fallback.imageAlt,
        href,
        modelHref: family ? ({ pathname: '/models/[slug]', params: { slug: modelSlug } } satisfies LocalizedLinkHref) : undefined,
        cloneHref: undefined,
        ctaLabel: fallback.cta,
        modelCtaLabel: fallback.modelCta,
        cloneLabel: fallback.cloneCta ?? content.examples.viewPrompt,
      },
    ];
  });
}

function buildComparisonCards(content: RedesignContent): ComparisonCard[] {
  return content.comparisons.cards
    .filter((card) => isPublishedComparisonSlug(card.slug))
    .map((card) => ({
      id: card.id,
      title: card.title,
      body: card.body,
      badges: card.badges,
      cta: content.comparisons.cta,
      href: { pathname: '/ai-video-engines/[slug]', params: { slug: card.slug } },
      imageSrc: card.imageSrc,
      imageAlt: card.imageAlt,
    }));
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
  const stats = computeEngineStats();
  const proofStats = buildProofStats(content, stats);
  const hero = buildHeroContent(locale, content);
  const [examples, programmedHeroSlots] = await Promise.all([
    loadHomepageExamples(locale, content),
    loadProgrammedHomepageHeroSlots(),
  ]);
  const programmedHeroItems = buildProgrammedHeroItems(locale, content, programmedHeroSlots);
  const primaryBestForCards = buildBestForGuideCards(content, BEST_FOR_MAIN_SLUGS);
  const comparisons = buildComparisonCards(content);
  const providers = filterProviderItems(content);
  const tools = filterToolCards(content, stats);
  const softwareSchema = buildSoftwareSchema(content);
  const faqSchema = buildFaqSchema(content.faq.items);
  const itemListSchema = buildItemListSchema(content, providers);

  return (
    <div className="home-monochrome">
      <HomeHero copy={hero} proofStats={proofStats} previews={examples.slice(0, 5)} programmedHeroItems={programmedHeroItems} />
      <ShotTypeEngineSelector copy={content.shotTypes} cards={primaryBestForCards} />
      <RealExamplesPreview copy={content.examples} examples={examples} providers={providers} />
      <ComparisonPreview copy={content.comparisons} comparisons={comparisons} />
      <ReferenceWorkflow copy={content.workflow} steps={content.workflow.steps} />
      <AiVideoToolbox copy={content.toolbox} tools={tools} />
      <TransparentPricingBlock copy={content.pricingTrust} cards={content.pricingTrust.cards} />
      <SeoKeywordBlock text={content.seoKeywordBlock} />
      <HomeFaq copy={content.faq} items={content.faq.items} />
      <Script id="home-webapp-jsonld" type="application/ld+json">
        {JSON.stringify(softwareSchema)}
      </Script>
      <Script id="home-faq-jsonld" type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </Script>
      <Script id="home-provider-itemlist-jsonld" type="application/ld+json">
        {JSON.stringify(itemListSchema)}
      </Script>
    </div>
  );
}
