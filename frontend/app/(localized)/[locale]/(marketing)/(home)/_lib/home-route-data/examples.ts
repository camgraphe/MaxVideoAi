import type { HomeExampleCard } from '@/components/marketing/home/HomeRedesignSections';
import { type AppLocale } from '@/i18n/locales';
import type { LocalizedLinkHref } from '@/i18n/navigation';
import { normalizeEngineId } from '@/lib/engine-alias';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { listExampleFamilyPage, listExamples, type GalleryVideo } from '@/server/videos';
import {
  DEFAULT_MODEL_BY_EXAMPLE_FAMILY,
  EXAMPLE_ENGINE_PRIORITY,
  HOMEPAGE_EXAMPLE_VIDEO_OVERRIDES,
} from './constants';
import { formatCurrency } from './formatting';
import { HOMEPAGE_EXAMPLE_FAMILIES, type HomepageExampleFamily, type RedesignContent } from './types';

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

export async function loadHomepageExamples(locale: AppLocale, content: RedesignContent): Promise<HomeExampleCard[]> {
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
