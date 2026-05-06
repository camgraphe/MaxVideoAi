import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { locales, type AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized, type EngineLocalizedContent } from '@/lib/models/i18n';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { normalizeEngineId } from '@/lib/engine-alias';
import { listPlaylistVideos, getPublicVideosByIds, type GalleryVideo } from '@/server/videos';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import {
  buildDetailSlugMap,
  MODELS_BASE_PATH_MAP,
} from './_lib/model-page-links';
import {
  buildPricePerImageLabel,
  buildPricePerImageRows,
  buildPricePerSecondLabel,
  buildPricePerSecondRows,
} from './_lib/model-page-pricing';
import {
  pickDemoMedia,
  pickHeroMedia,
  toFeaturedMedia,
  toGalleryCard,
  type FeaturedMedia,
} from './_lib/model-page-media';
import { loadEngineKeySpecs } from './_lib/model-page-key-specs';
import { PREFERRED_MEDIA } from './_lib/model-page-static';
import {
  DEFAULT_DETAIL_COPY,
  MODEL_OG_IMAGE_MAP,
  buildSoraCopy,
  pickCompareEngines,
  type DetailCopy,
} from './_lib/model-page-copy';
import {
  buildSpecValues,
  isPending,
  isUnsupported,
  normalizeMaxResolution,
  resolveAudioPricingLabels,
  resolveSpecRowDefs,
  resolveSpecRowLabel,
  type KeySpecRow,
} from './_lib/model-page-specs';
import { MarketingModelPageLayout } from './_components/MarketingModelPageLayout';

type PageParams = {
  params: Promise<{
    locale: AppLocale;
    slug: string;
  }>;
};

export const dynamicParams = false;
export const revalidate = 300;

export function generateStaticParams() {
  const engines = listFalEngines();
  return locales.flatMap((locale) =>
    engines
      .filter((entry) => entry.surfaces.modelPage.includeInSitemap !== false)
      .map((entry) => ({ locale, slug: entry.modelSlug }))
  );
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const params = await props.params;
  const { slug, locale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!engine || engine.surfaces.modelPage.includeInSitemap === false) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const canonicalSlug = engine.modelSlug ?? slug;
  const localized = await getEngineLocalized(canonicalSlug, locale);
  const detailSlugMap = buildDetailSlugMap(canonicalSlug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${canonicalSlug}`));
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const title = localized.seo.title ?? fallbackTitle;
  const description =
    localized.seo.description ??
    engine.seo.description ??
    'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
  const ogImagePath =
    localized.seo.image ?? MODEL_OG_IMAGE_MAP[canonicalSlug] ?? engine.media?.imagePath ?? '/og/price-before.png';
  return buildSeoMetadata({
    locale,
    title,
    description,
    slugMap: detailSlugMap,
    englishPath: `/models/${canonicalSlug}`,
    availableLocales: publishableLocales,
    image: ogImagePath,
    imageAlt: title,
    ogType: 'article',
    robots: {
      index: engine.surfaces.modelPage.indexable,
      follow: true,
    },
  });
}

async function renderMarketingModelPage({
  engine,
  detailCopy,
  localizedContent,
  locale,
}: {
  engine: FalEngineEntry;
  detailCopy: DetailCopy;
  localizedContent: EngineLocalizedContent;
  locale: AppLocale;
}) {
  const detailSlugMap = buildDetailSlugMap(engine.modelSlug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${engine.modelSlug}`));
  const metadataUrls = buildMetadataUrls(locale, detailSlugMap, {
    englishPath: `/models/${engine.modelSlug}`,
    availableLocales: publishableLocales,
  });
  const canonicalRaw = metadataUrls.canonical;
  const canonicalUrl = canonicalRaw.replace(/\/+$/, '') || canonicalRaw;
  const localizedCanonicalUrl = canonicalUrl;
  const copy = buildSoraCopy(localizedContent, engine.modelSlug, locale);
  const engineModes = engine.engine.modes ?? [];
  const hasVideoMode = engineModes.some((mode) => mode.endsWith('v'));
  const hasImageMode = engineModes.some((mode) => mode.endsWith('i'));
  const isVideoEngine = hasVideoMode;
  const isImageEngine = hasImageMode && !hasVideoMode;
  const enginePricingOverrides = await listEnginePricingOverrides();
  const pricingEngine = applyEnginePricingOverride(
    engine.engine,
    enginePricingOverrides[engine.engine.id]
  );
  const backPath = (() => {
    try {
      const url = new URL(canonicalUrl);
      return url.pathname || `/models/${engine.modelSlug}`;
    } catch {
      return `/models/${engine.modelSlug}`;
    }
  })();
  let examples: GalleryVideo[] = [];
  const examplePlaylistKeys =
    engine.modelSlug === 'ltx-2-3-pro' ? ['examples-ltx-2-3-pro', 'examples-ltx-2-3'] : [`examples-${engine.modelSlug}`];
  try {
    for (const playlistKey of examplePlaylistKeys) {
      examples = await listPlaylistVideos(playlistKey, 200);
      if (examples.length) break;
    }
  } catch (error) {
    console.warn('[models/sora-2] failed to load examples', error);
  }
  const normalizedSlug = normalizeEngineId(engine.modelSlug) ?? engine.modelSlug;
  const allowedEngineIds = new Set([
    normalizedSlug,
    engine.modelSlug,
    engine.id,
    ...(engine.modelSlug === 'sora-2-pro' ? ['sora-2', 'sora2'] : []),
    ...(engine.modelSlug === 'sora-2' ? ['sora-2', 'sora2'] : []),
  ].map((id) => (id ? id.toString().trim().toLowerCase() : '')).filter(Boolean));
  const soraExamples = examples.filter((video) => {
    const normalized = normalizeEngineId(video.engineId)?.trim().toLowerCase();
    return normalized ? allowedEngineIds.has(normalized) : false;
  });
  const validatedMap = await getPublicVideosByIds(soraExamples.map((video) => video.id));
  let galleryVideos = soraExamples
    .filter((video) => validatedMap.has(video.id))
    .map((video) =>
      toGalleryCard(
        video,
        engine.brandId,
        localizedContent.marketingName ?? engine.marketingName,
        engine.modelSlug,
        engine.modelSlug,
        backPath
      )
    );

  const preferredIds = PREFERRED_MEDIA[engine.modelSlug] ?? { hero: null, demo: null };
  const preferredList = [preferredIds.hero, preferredIds.demo].filter((id): id is string => Boolean(id));
  const missingPreferred = preferredList.filter((id) => !galleryVideos.some((video) => video.id === id));
  if (missingPreferred.length) {
    const preferredMap = await getPublicVideosByIds(missingPreferred);
    for (const id of preferredList) {
      if (!preferredMap.has(id) || galleryVideos.some((video) => video.id === id)) continue;
      const video = preferredMap.get(id)!;
      galleryVideos = [
        ...galleryVideos,
        toGalleryCard(
          video,
          engine.brandId,
          localizedContent.marketingName ?? engine.marketingName,
          engine.modelSlug,
          engine.modelSlug,
          backPath
        ),
      ];
    }
  }
  if (engine.modelSlug === 'kling-2-5-turbo') {
    const isSixteenNine = (aspect?: string | null) => {
      const normalized = (aspect ?? '').trim();
      return normalized === '16:9' || normalized.startsWith('16:9');
    };
    galleryVideos = [...galleryVideos].sort((a, b) => {
      const aScore = (isSixteenNine(a.aspectRatio) ? 0 : 2) + (a.videoUrl ? 0 : 1);
      const bScore = (isSixteenNine(b.aspectRatio) ? 0 : 2) + (b.videoUrl ? 0 : 1);
      return aScore - bScore;
    });
  }

  const modelName = localizedContent.marketingName ?? engine.marketingName;
  const fallbackMedia: FeaturedMedia = {
    id: `${engine.modelSlug}-hero-fallback`,
    prompt:
      engine.type === 'image'
        ? `${modelName} demo still from MaxVideoAI`
        : `${modelName} demo clip from MaxVideoAI`,
    videoUrl: engine.type === 'image' ? null : engine.media?.videoUrl ?? engine.demoUrl ?? null,
    posterUrl:
      engine.media?.imagePath ??
      buildOptimizedPosterUrl(engine.media?.imagePath, { width: 1200, quality: 75 }) ??
      null,
    durationSec: null,
    hasAudio: engine.type === 'image' ? false : true,
    href: null,
    label: modelName ?? 'Sora',
  };

  let heroMedia = pickHeroMedia(galleryVideos, preferredIds.hero, fallbackMedia);
  if (engine.modelSlug === 'kling-2-5-turbo') {
    const heroCandidate =
      galleryVideos.find((video) => video.aspectRatio === '16:9' && Boolean(video.videoUrl)) ??
      galleryVideos.find((video) => video.aspectRatio === '16:9');
    if (heroCandidate) {
      heroMedia = toFeaturedMedia(heroCandidate) ?? heroMedia;
    }
  }
  const demoMedia = pickDemoMedia(galleryVideos, heroMedia?.id ?? null, preferredIds.demo, fallbackMedia);
  if (engine.modelSlug === 'minimax-hailuo-02-text' && demoMedia) {
    demoMedia.prompt =
      'A cinematic 10-second shot in 16:9. At night, the camera flies smoothly through a modern city full of soft neon lights and warm windows, then glides towards a single bright window high on a building. Without cutting, the camera passes through the glass into a cozy creator studio with a large desk and an ultra-wide monitor glowing in the dark. The room is lit by the screen and a warm desk lamp. The camera continues to push in until the monitor fills most of the frame. On the screen there is a clean AI video workspace UI (generic, no real logos) showing four small video previews playing at the same time: one realistic city street shot, one colourful animation, one product hero shot and one abstract motion-graphics scene. The overall style is cinematic, with smooth camera motion, gentle depth of field and rich contrast.';
  }
  const galleryCtaHref = heroMedia?.id
    ? `${isImageEngine ? '/app/image' : '/app'}?engine=${engine.modelSlug}&from=${encodeURIComponent(heroMedia.id)}`
    : `${isImageEngine ? '/app/image' : '/app'}?engine=${engine.modelSlug}`;
  const compareEngines = pickCompareEngines(listFalEngines(), engine.modelSlug);
  const faqEntries = localizedContent.faqs.length ? localizedContent.faqs : copy.faqs;
  const showPriceInSpecs = true;
  const keySpecsMap = await loadEngineKeySpecs();
  const keySpecsEntry =
    keySpecsMap.get(engine.modelSlug) ?? keySpecsMap.get(engine.id) ?? null;
  const pricePerSecondLabel = await buildPricePerSecondLabel(pricingEngine, locale);
  const pricePerImageLabel = await buildPricePerImageLabel(pricingEngine, locale);
  const keySpecValues = buildSpecValues(engine, keySpecsEntry?.keySpecs, {
    pricePerSecond: pricePerSecondLabel,
    pricePerImage: pricePerImageLabel,
  });
  const priceRows = showPriceInSpecs
    ? isImageEngine
      ? await buildPricePerImageRows(pricingEngine, locale, resolveSpecRowLabel(locale, 'pricePerImage', true))
      : await buildPricePerSecondRows(
          pricingEngine,
          locale,
          resolveSpecRowLabel(locale, 'pricePerSecond', false),
          resolveAudioPricingLabels(locale)
        )
    : [];
  const rowDefs = resolveSpecRowDefs(locale, isImageEngine);
  const pricePerSecondRowLabel = resolveSpecRowLabel(locale, 'pricePerSecond', false);
  const pricePerImageRowLabel = resolveSpecRowLabel(locale, 'pricePerImage', true);
  const keySpecDefs = rowDefs.filter((row) => row.key !== (isImageEngine ? 'pricePerImage' : 'pricePerSecond'));
  const fallbackPriceRows: KeySpecRow[] = priceRows.length
    ? []
    : isImageEngine
      ? keySpecValues?.pricePerImage && !isUnsupported(keySpecValues.pricePerImage)
        ? [
            {
              id: 'pricePerImage',
              key: 'pricePerImage',
              label: pricePerImageRowLabel,
              value: keySpecValues.pricePerImage,
            },
          ]
        : []
      : keySpecValues?.pricePerSecond && !isUnsupported(keySpecValues.pricePerSecond)
      ? [
          {
            id: 'pricePerSecond',
            key: 'pricePerSecond',
            label: pricePerSecondRowLabel,
            value: keySpecValues.pricePerSecond,
          },
        ]
      : [];
  const keySpecRows: KeySpecRow[] = keySpecValues
    ? [
        ...(priceRows.length ? priceRows : fallbackPriceRows),
        ...keySpecDefs
          .map(({ key, label }) => ({
            id: key,
            key,
            label,
            value:
              key === 'maxResolution' && !isImageEngine
                ? normalizeMaxResolution(keySpecValues[key])
                : keySpecValues[key],
          }))
          .filter((row) => !isPending(row.value) && !isUnsupported(row.value)),
      ]
    : [];

  return (
    <MarketingModelPageLayout
      backLabel={detailCopy.backLabel}
      pricingLinkLabel={detailCopy.pricingLinkLabel}
      localizedContent={localizedContent}
      copy={copy}
      engine={engine}
      isVideoEngine={isVideoEngine}
      isImageEngine={isImageEngine}
      heroMedia={heroMedia}
      demoMedia={demoMedia}
      galleryVideos={galleryVideos}
      galleryCtaHref={galleryCtaHref}
      compareEngines={compareEngines}
      faqEntries={faqEntries}
      keySpecRows={keySpecRows}
      keySpecValues={keySpecValues}
      pricePerImageLabel={pricePerImageLabel}
      pricePerSecondLabel={pricePerSecondLabel}
      engineSlug={engine.modelSlug}
      locale={locale}
      canonicalUrl={canonicalUrl}
      localizedCanonicalUrl={localizedCanonicalUrl}
      breadcrumb={detailCopy.breadcrumb}
    />
  );
}

export default async function ModelDetailPage(props: PageParams) {
  const params = await props.params;
  const { slug, locale: routeLocale } = params;
  const localizedModelsBase = (MODELS_BASE_PATH_MAP[routeLocale ?? 'en'] ?? 'models').replace(/^\/+|\/+$/g, '');
  if (slug === 'veo-3-1-first-last') {
    permanentRedirect(`/${localizedModelsBase}/veo-3-1`.replace(/\/{2,}/g, '/'));
  }
  if (slug === 'veo-3-1-first-last-fast') {
    permanentRedirect(`/${localizedModelsBase}/veo-3-1-fast`.replace(/\/{2,}/g, '/'));
  }
  const engine = getFalEngineBySlug(slug);
  if (!engine || engine.surfaces.modelPage.includeInSitemap === false) {
    notFound();
  }

  if (slug !== engine.modelSlug) {
    permanentRedirect(`/${localizedModelsBase}/${engine.modelSlug}`.replace(/\/{2,}/g, '/'));
  }

  {
    // Default every model slug to the canonical marketing renderer so new launches
    // do not silently fall back to the older, thinner detail page.
    const activeLocale = routeLocale ?? 'en';
    const { dictionary } = await resolveDictionary();
    const detailCopy: DetailCopy = {
      ...DEFAULT_DETAIL_COPY,
      ...(dictionary.models.detail ?? {}),
      breadcrumb: { ...DEFAULT_DETAIL_COPY.breadcrumb, ...(dictionary.models.detail?.breadcrumb ?? {}) },
    };
    const localizedContent = await getEngineLocalized(engine.modelSlug, activeLocale);
    return await renderMarketingModelPage({
      engine,
      detailCopy,
      localizedContent,
      locale: activeLocale,
    });
  }
}
