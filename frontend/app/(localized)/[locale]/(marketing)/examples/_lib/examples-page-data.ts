import type { ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import type { AppLocale } from '@/i18n/locales';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { getExampleFamilyDescriptor } from '@/lib/model-families';
import type { listExamplesPage } from '@/server/videos';
import {
  CURRENT_ENGINE_MODEL_LINKS_BY_GROUP,
  ENGINE_META,
  ENGINE_MODEL_LINKS,
  ENGINE_MODEL_LINKS_BY_GROUP,
  GALLERY_POSTER_OPTIONS,
  HERO_POSTER_OPTIONS,
  PREFERRED_ENGINE_ORDER,
  buildLocalizedExampleLabel,
  buildModelHref,
  formatModelSlugLabel,
  formatPromptExcerpt,
  getPlaceholderPoster,
  normalizeFilterId,
  resolveEngineLinkId,
  resolveFilterDescriptor,
  type EngineFilterOption,
} from './examples-route-utils';

type ExampleRouteVideo = Awaited<ReturnType<typeof listExamplesPage>>['items'][number];

export type ExamplesModelLink = {
  slug: string;
  label: string;
  href: string;
};

export function buildExamplesEngineFilterState({
  allVideos,
  collapsedEngineParam,
}: {
  allVideos: ExampleRouteVideo[];
  collapsedEngineParam: string;
}) {
  const engineFilterMap = allVideos.reduce<Map<string, EngineFilterOption>>((acc, video) => {
    const canonicalEngineId = resolveEngineLinkId(video.engineId);
    if (!canonicalEngineId) return acc;
    const engineMeta = ENGINE_META.get(canonicalEngineId.toLowerCase()) ?? null;
    const descriptor = resolveFilterDescriptor(canonicalEngineId, engineMeta);
    if (!descriptor) return acc;
    const filterKey = descriptor.id.toLowerCase();
    const existing = acc.get(filterKey);
    if (existing) {
      existing.count += 1;
      return acc;
    }
    acc.set(filterKey, {
      id: descriptor.id,
      key: filterKey,
      label: descriptor.label,
      brandId: descriptor.brandId,
      count: 1,
    });
    return acc;
  }, new Map());

  const engineFilterOptions = PREFERRED_ENGINE_ORDER.map((preferredId) => {
    const key = normalizeFilterId(preferredId);
    const existing = engineFilterMap.get(key);
    if (existing) {
      return existing;
    }
    const base = getExampleFamilyDescriptor(preferredId) ?? { id: preferredId, label: preferredId, brandId: undefined };
    return {
      id: base.id,
      key,
      label: base.label,
      brandId: base.brandId,
      count: 0,
    };
  });
  const selectedOption =
    collapsedEngineParam && engineFilterOptions.length
      ? engineFilterOptions.find((option) => option.key === normalizeFilterId(collapsedEngineParam)) ?? null
      : null;

  return {
    engineFilterOptions,
    selectedOption,
    selectedEngine: selectedOption?.id ?? null,
  };
}

export function buildExamplesModelLinks({
  locale,
  selectedEngine,
  usesCurrentAndSupportedBlocks,
}: {
  locale: AppLocale;
  selectedEngine: string | null;
  usesCurrentAndSupportedBlocks: boolean;
}) {
  const modelSlugs = selectedEngine ? ENGINE_MODEL_LINKS_BY_GROUP[selectedEngine.toLowerCase()] ?? [] : [];
  const modelLinks = modelSlugs.map((slug) => {
    const label = ENGINE_META.get(slug)?.label ?? formatModelSlugLabel(slug);
    return {
      slug,
      label,
      href: buildModelHref(locale, slug),
    };
  });
  const currentModelSlugs = selectedEngine ? CURRENT_ENGINE_MODEL_LINKS_BY_GROUP[selectedEngine.toLowerCase()] ?? [] : [];
  const currentModelSlugSet = new Set(currentModelSlugs);
  const primaryModelLinks =
    usesCurrentAndSupportedBlocks && currentModelSlugSet.size
      ? modelLinks.filter((model) => currentModelSlugSet.has(model.slug))
      : usesCurrentAndSupportedBlocks
        ? modelLinks.slice(0, 2)
        : modelLinks;
  const supportedOlderModelLinks =
    usesCurrentAndSupportedBlocks && currentModelSlugSet.size
      ? modelLinks.filter((model) => !currentModelSlugSet.has(model.slug))
      : usesCurrentAndSupportedBlocks
        ? modelLinks.slice(2)
        : [];

  return {
    modelLinks,
    primaryModelLinks,
    supportedOlderModelLinks,
  };
}

export function buildExamplesGalleryData({
  allVideos,
  locale,
  selectedEngine,
}: {
  allVideos: ExampleRouteVideo[];
  locale: AppLocale;
  selectedEngine: string | null;
}): {
  videos: ExampleRouteVideo[];
  clientVideos: ExampleGalleryVideo[];
} {
  const filteredEntries = selectedEngine
    ? allVideos
        .map((video, index) => {
          const canonicalEngineId = resolveEngineLinkId(video.engineId);
          if (!canonicalEngineId) return null;
          const engineMeta = ENGINE_META.get(canonicalEngineId.toLowerCase()) ?? null;
          const descriptor = resolveFilterDescriptor(canonicalEngineId, engineMeta);
          if (!descriptor) return null;
          if (descriptor.id.toLowerCase() !== selectedEngine.toLowerCase()) return null;
          return { video, index };
        })
        .filter((entry): entry is { video: ExampleRouteVideo; index: number } => Boolean(entry))
    : allVideos.map((video, index) => ({ video, index }));

  return {
    videos: filteredEntries.map((entry) => entry.video),
    clientVideos: filteredEntries.map(({ video, index }) => buildClientVideo({ video, index, locale })),
  };
}

function buildClientVideo({
  index,
  locale,
  video,
}: {
  index: number;
  locale: AppLocale;
  video: ExampleRouteVideo;
}): ExampleGalleryVideo {
  const canonicalEngineId = resolveEngineLinkId(video.engineId);
  const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
  const engineMeta = engineKey ? ENGINE_META.get(engineKey) ?? null : null;
  const descriptor = canonicalEngineId ? resolveFilterDescriptor(canonicalEngineId, engineMeta) : null;
  const modelSlug = engineMeta?.modelSlug ?? (descriptor ? ENGINE_MODEL_LINKS[descriptor.id.toLowerCase()] : null);
  const modelHref = modelSlug ? buildModelHref(locale, modelSlug) : null;
  const promptDisplay =
    locale === 'en'
      ? formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render')
      : buildLocalizedExampleLabel(
          locale,
          engineMeta?.label ?? video.engineLabel ?? 'Engine',
          video.aspectRatio ?? null,
          video.durationSec
        );

  return {
    id: video.id,
    href: `/video/${encodeURIComponent(video.id)}`,
    engineLabel: engineMeta?.label ?? video.engineLabel ?? 'Engine',
    engineIconId: engineMeta?.id ?? canonicalEngineId ?? video.engineId ?? 'engine',
    engineBrandId: engineMeta?.brandId,
    priceLabel: null,
    prompt: promptDisplay,
    promptFull: locale === 'en' ? video.prompt ?? null : null,
    aspectRatio: video.aspectRatio ?? null,
    durationSec: video.durationSec,
    hasAudio: video.hasAudio,
    heroPosterUrl: video.thumbUrl ? buildOptimizedPosterUrl(video.thumbUrl, HERO_POSTER_OPTIONS) : null,
    optimizedPosterUrl: video.thumbUrl ? buildOptimizedPosterUrl(video.thumbUrl, GALLERY_POSTER_OPTIONS) : null,
    rawPosterUrl: video.thumbUrl ?? getPlaceholderPoster(video.aspectRatio),
    videoUrl: video.videoUrl ?? null,
    previewVideoUrl: video.previewVideoUrl ?? null,
    modelHref,
    sourceIndex: index,
  };
}
