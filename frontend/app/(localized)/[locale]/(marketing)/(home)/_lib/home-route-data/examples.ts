import type { HomeExampleCard } from '@/components/marketing/home/HomeRedesignSections';
import { type AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { MODEL_LAUNCH_READY_MODELS, type ModelLaunchReadinessEntry } from '@/config/model-launch-readiness';
import { listRuntimeModels, type RuntimeModelEntry } from '@/config/model-runtime';
import { normalizeEngineId } from '@/lib/engine-alias';
import { listExampleFamilyPage, listExamples, listPlaylistVideos, type GalleryVideo } from '@/server/videos';
import {
  DEFAULT_MODEL_BY_EXAMPLE_FAMILY,
  EXAMPLE_ENGINE_PRIORITY,
  HOMEPAGE_EXAMPLE_CARD_LIMIT,
  HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES,
  HOMEPAGE_HERO_PREVIEW_LIMIT,
} from './constants';
import { formatCurrency } from './formatting';
import { HOMEPAGE_EXAMPLE_FAMILIES, type HomepageExampleFamily, type RedesignContent } from './types';
import { buildHomepageP0PromotionCards, buildHomepageP0PromotionTargets } from './launch-promotions';

export { buildHomepageP0PromotionTargets } from './launch-promotions';

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
  preferredVideoId?: string
): GalleryVideo | null {
  const normalizedTarget = normalizeEngineId(targetEngineId) ?? targetEngineId;
  const usable = videos.filter((video) => {
    if (!video.thumbUrl) return false;
    const engineId = normalizeEngineId(video.engineId) ?? video.engineId;
    return engineId === normalizedTarget;
  });
  const preferred = preferredVideoId ? usable.find((video) => video.id === preferredVideoId && video.aspectRatio === '16:9') : null;
  if (preferred) return preferred;
  const exactEngine = usable.filter((video) => (normalizeEngineId(video.engineId) ?? video.engineId) === normalizedTarget);
  const exact16x9 = exactEngine.find((video) => video.aspectRatio === '16:9');
  if (exact16x9) return exact16x9;
  return exactEngine[0] ?? null;
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

export function assembleHomepageExampleCards({
  locale,
  content,
  globalCandidates,
  familyVideos,
  modelVideos = new Map(),
  models = listRuntimeModels(),
  readiness = MODEL_LAUNCH_READY_MODELS,
}: {
  locale: AppLocale;
  content: RedesignContent;
  globalCandidates: GalleryVideo[];
  familyVideos: ReadonlyMap<HomepageExampleFamily, GalleryVideo[]>;
  modelVideos?: ReadonlyMap<string, GalleryVideo[]>;
  models?: readonly RuntimeModelEntry[];
  readiness?: readonly ModelLaunchReadinessEntry[];
}): HomeExampleCard[] {
  const fallbackCards = content.examples.fallbackCards.flatMap<HomeExampleCard>((fallback) => {
    const family = fallback.examplesSlug;
    const familyCandidates = family ? familyVideos.get(family) ?? [] : [];
    const override = HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES[fallback.engineId];
    const video = preferHomepageExampleVideo([...globalCandidates, ...familyCandidates], fallback.engineId, override?.videoId);
    const engineId = video ? normalizeEngineId(video.engineId) ?? video.engineId : fallback.engineId;
    const modelSlug = family ? DEFAULT_MODEL_BY_EXAMPLE_FAMILY[family] : fallback.modelSlug ?? fallback.engineId;
    const modelCtaLabel = fallback.modelCta ?? 'Specs & pricing';
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
        modelCtaLabel,
        cloneLabel: fallback.cloneCta ?? content.examples.viewPrompt,
      },
    ];
  });

  const launchCards = buildHomepageP0PromotionCards({
    locale,
    content,
    targets: buildHomepageP0PromotionTargets({ models, readiness }),
    modelVideos,
  });

  const priority = new Map<string, number>(EXAMPLE_ENGINE_PRIORITY.map((id, index) => [id, index]));
  const seenEngineIds = new Set<string>();
  return [...launchCards, ...fallbackCards]
    .filter((card) => {
      const engineId = card.engineId ?? card.id;
      if (seenEngineIds.has(engineId)) return false;
      seenEngineIds.add(engineId);
      return true;
    })
    .sort((left, right) => (
      (priority.get(left.engineId ?? '') ?? Number.MAX_SAFE_INTEGER) -
      (priority.get(right.engineId ?? '') ?? Number.MAX_SAFE_INTEGER)
    ))
    .slice(0, Math.min(HOMEPAGE_EXAMPLE_CARD_LIMIT, content.examples.fallbackCards.length));
}

export function selectHomepageHeroPreviews<T>(cards: readonly T[]): T[] {
  return cards.slice(0, HOMEPAGE_HERO_PREVIEW_LIMIT);
}

type HomepageExamplesLoaderDependencies = {
  models: readonly RuntimeModelEntry[];
  readiness: readonly ModelLaunchReadinessEntry[];
  listExamples: typeof listExamples;
  listExampleFamilyPage: typeof listExampleFamilyPage;
  listPlaylistVideos: typeof listPlaylistVideos;
};

export async function loadHomepageExamples(
  locale: AppLocale,
  content: RedesignContent,
  dependencies: Partial<HomepageExamplesLoaderDependencies> = {},
): Promise<HomeExampleCard[]> {
  const models = dependencies.models ?? listRuntimeModels();
  const readiness = dependencies.readiness ?? MODEL_LAUNCH_READY_MODELS;
  const loadExamples = dependencies.listExamples ?? listExamples;
  const loadExampleFamilyPage = dependencies.listExampleFamilyPage ?? listExampleFamilyPage;
  const loadPlaylistVideos = dependencies.listPlaylistVideos ?? listPlaylistVideos;
  const promotionTargets = buildHomepageP0PromotionTargets({ models, readiness });
  const promotionFamilies = new Set<string>(promotionTargets.map(({ family }) => family));
  const familyIds = HOMEPAGE_EXAMPLE_FAMILIES.filter(
    (family) => !['wan', 'grok', 'flux'].includes(family) || promotionFamilies.has(family),
  );
  const [latestVideos, playlistVideos, familyPools, modelPools] = await Promise.all([
    loadExamples('date-desc', 120).catch(() => [] as GalleryVideo[]),
    loadExamples('playlist', 120).catch(() => [] as GalleryVideo[]),
    Promise.all(
      familyIds.map(async (family) => {
        const result = await loadExampleFamilyPage(family, { sort: 'date-desc', limit: 24, offset: 0 }).catch(() => ({
          items: [] as GalleryVideo[],
          total: 0,
          limit: 24,
          offset: 0,
          hasMore: false,
        }));
        return [family, result.items] as const;
      })
    ),
    Promise.all(promotionTargets.map(async (target) => [
      target.modelId,
      await loadPlaylistVideos(target.readiness.modelPlaylistSlug, 2).catch(() => [] as GalleryVideo[]),
    ] as const)),
  ]);

  return assembleHomepageExampleCards({
    locale,
    content,
    globalCandidates: [...latestVideos, ...sortExamplesByPriority(playlistVideos)],
    familyVideos: new Map(familyPools),
    modelVideos: new Map(modelPools),
    models,
    readiness,
  });
}
