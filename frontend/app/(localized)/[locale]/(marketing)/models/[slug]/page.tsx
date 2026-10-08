import { modelExamplePlaylistKeys, projectModelPageGallery } from '@/server/model-gallery-projection';
import { hasPlaylistCuration } from '@/server/playlists/curation-service';
import '@/styles/marketing-models.css';
import { ModelArchivePage } from './_components/ModelArchivePage';
import { buildModelArchiveMetadata } from './_lib/model-page-archive-metadata';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import {
  isRuntimeModelPagePublished,
  isRuntimePresentationOnlyModel,
  listPublishedRuntimeModels,
  resolveRuntimePublicSlug,
} from '@/config/model-runtime';
import { locales, type AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized, type EngineLocalizedContent } from '@/lib/models/i18n';
import { resolvePublicMarketingVideoUrl } from '@/lib/media';
import { listPlaylistVideos, getPublicVideosByIds, type GalleryVideo } from '@/server/videos';
import { quoteCurrentExamplePrices, type CurrentExamplePrice } from '@/server/current-example-price';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { loadModelPageInputs } from './_lib/model-page-inputs';
import {
  buildDetailSlugMap,
  MODELS_BASE_PATH_MAP,
} from './_lib/model-page-links';
import { buildModelDecisionData } from './_lib/model-page-decision-data';
import { isPublishedModelPage } from './_lib/model-page-publication';
import {
  buildPricePerImageLabel,
  buildPricePerImageRows,
  buildPricePerSecondLabel,
  buildPricePerSecondRows,
} from './_lib/model-page-pricing';
import {
  pickDemoMedia,
  pickHeroMedia,
  normalizeMediaUrl,
  toFeaturedMedia,
  toGalleryCard,
  type FeaturedMedia,
} from './_lib/model-page-media';
import { FEATURED_EXAMPLE_MEDIA, PREFERRED_MEDIA } from './_lib/model-page-static';
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
import {
  buildModelPrelaunchMetadata,
  renderMarketingModelPrelaunchPage,
} from './_lib/model-page-prelaunch-route';
import { isPrelaunchModelPageTemplateSlug } from './_lib/model-page-template-registry';

type PageParams = {
  params: Promise<{
    locale: AppLocale;
    slug: string;
  }>;
};

export const dynamicParams = false;
export const revalidate = 300;

const UNBRANDED_MODEL_TITLE_SLUGS = new Set([
  'pika-text-to-video',
  'ltx-2-3-fast',
  'seedance-2-0',
  'seedance-2-5',
  'veo-3-1',
]);

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    listPublishedRuntimeModels().map((model) => ({ locale, slug: model.slug }))
  );
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const params = await props.params;
  const { slug, locale } = params;
  const model = resolveRuntimePublicSlug(slug);
  if (!model || !isRuntimeModelPagePublished(model)) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const canonicalSlug = model.slug;
  const localized = await getEngineLocalized(canonicalSlug, locale);
  if (model.lifecycle === 'deep_legacy' && localized.archive) {
    return buildModelArchiveMetadata(model, localized.archive, locale);
  }
  const detailSlugMap = buildDetailSlugMap(canonicalSlug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${canonicalSlug}`));

  if (
    isRuntimePresentationOnlyModel(model) ||
    isPrelaunchModelPageTemplateSlug(canonicalSlug)
  ) {
    return buildModelPrelaunchMetadata({
      model,
      localizedContent: localized,
      locale,
    });
  }

  const engine = getFalEngineBySlug(slug);
  if (!isPublishedModelPage(engine)) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const decisionData = buildModelDecisionData({
    engine,
    locale,
    decisionContent: localized.decision,
  });
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const title = decisionData?.meta.title ?? localized.seo.title ?? fallbackTitle;
  const description =
    decisionData?.meta.description ??
    localized.seo.description ??
    engine.seo.description ??
    'Explore availability, prompts, pricing, and render policies for this model on MaxVideoAI.';
  const ogImagePath =
    localized.seo.image ?? MODEL_OG_IMAGE_MAP[canonicalSlug] ?? engine.media?.imagePath ?? '/og/brand-2026-09-25.png';
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
    titleBranding: locale === 'en' && UNBRANDED_MODEL_TITLE_SLUGS.has(canonicalSlug) ? 'none' : 'auto',
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
  const appPath = engine.category === 'image' ? '/app/image' : '/app';
  const appGenerationEnabled = engine.surfaces.app.enabled;
  const fallbackMarketingHref = copy.primaryCtaHref ?? localizedContent.hero?.ctaPrimary?.href ?? `/models/${engine.modelSlug}`;
  const resolveGalleryCardHref = <T extends { recreateHref?: string | null }>(card: T): T =>
    appGenerationEnabled ? card : { ...card, recreateHref: fallbackMarketingHref };
  const engineModes = engine.engine.modes ?? [];
  const hasVideoMode = engineModes.some((mode) => mode.endsWith('v'));
  const hasImageMode = engineModes.some((mode) => mode.endsWith('i'));
  const isVideoEngine = hasVideoMode;
  const isImageEngine = hasImageMode && !hasVideoMode;
  const backPath = (() => {
    try {
      const url = new URL(canonicalUrl);
      return url.pathname || `/models/${engine.modelSlug}`;
    } catch {
      return `/models/${engine.modelSlug}`;
    }
  })();
  const { benchmarkScoreSlugs, enginePricingOverrides, keySpecsMap, gallery } = await loadModelPageInputs(
    locale,
    async () => {
      let examples: GalleryVideo[] = [];
      let managedCuration=false;
      const examplePlaylistKeys = modelExamplePlaylistKeys(engine.modelSlug);
      try {
        for (const playlistKey of examplePlaylistKeys) {
          examples = await listPlaylistVideos(playlistKey, 200);
          managedCuration=await hasPlaylistCuration(playlistKey);
          if (examples.length || managedCuration) break;
        }
      } catch (error) {
        console.warn('[models/sora-2] failed to load examples', error);
      }
      const examplePrices = new Map<string, CurrentExamplePrice>();
      const readPricedVideos = async (ids: string[]) => {
        const videos = await getPublicVideosByIds(ids);
        const prices = await quoteCurrentExamplePrices(Array.from(videos.values()));
        for (const [id, price] of prices) examplePrices.set(id, price);
        return videos;
      };
      return projectModelPageGallery({
        engine, examples, managed: managedCuration,
        preferred: PREFERRED_MEDIA[engine.modelSlug] ?? {hero:null,demo:null},
        featuredIds: FEATURED_EXAMPLE_MEDIA[engine.modelSlug] ?? [],
        getPublicVideosByIds: readPricedVideos,
        toCard: video => resolveGalleryCardHref(toGalleryCard(
          video, engine.brandId, localizedContent.marketingName ?? engine.marketingName,
          engine.modelSlug, engine.id, backPath, appPath, examplePrices.get(video.id), locale,
        )),
      });
    }
  );
  const { galleryVideos, preferredIds, managed: managedCuration } = gallery;
  const showBenchmarkLink = isVideoEngine && benchmarkScoreSlugs.has(engine.modelSlug);
  const pricingEngine = applyEnginePricingOverride(engine.engine, enginePricingOverrides[engine.engine.id]);
  const modelName = localizedContent.marketingName ?? engine.marketingName;
  const fallbackMedia: FeaturedMedia = {
    id: `${engine.modelSlug}-hero-fallback`,
    prompt:
      engine.type === 'image'
        ? `${modelName} demo still from MaxVideoAI`
        : `${modelName} demo clip from MaxVideoAI`,
    videoUrl:
      engine.type === 'image'
        ? null
        : (resolvePublicMarketingVideoUrl(engine.media?.videoUrl) ?? resolvePublicMarketingVideoUrl(engine.demoUrl)),
    posterUrl: normalizeMediaUrl(engine.media?.imagePath),
    durationSec: null,
    hasAudio: engine.type === 'image' ? false : true,
    href: null,
    label: modelName ?? 'Sora',
  };

  let heroMedia = pickHeroMedia(galleryVideos, preferredIds.hero, fallbackMedia, { preserveOrder: managedCuration });
  if (!managedCuration && engine.modelSlug === 'kling-2-5-turbo') {
    const heroCandidate =
      galleryVideos.find((video) => video.aspectRatio === '16:9' && Boolean(video.videoUrl)) ??
      galleryVideos.find((video) => video.aspectRatio === '16:9');
    if (heroCandidate) {
      heroMedia = toFeaturedMedia(heroCandidate) ?? heroMedia;
    }
  }
  let demoMedia = pickDemoMedia(galleryVideos, heroMedia?.id ?? null, preferredIds.demo, fallbackMedia, {
    allowFallbackReuse: engine.modelSlug === 'happy-horse-1-1',
  });
  if (engine.modelSlug === 'sora-2-pro') {
    demoMedia = heroMedia;
  }
  const compareEngines = pickCompareEngines(listFalEngines(), engine.modelSlug);
  const faqEntries = localizedContent.faqs.length ? localizedContent.faqs : copy.faqs;
  const showPriceInSpecs =
    engine.id !== 'lumaRay2' && engine.surfaces.pricing.includeInEstimator;
  const keySpecsEntry =
    keySpecsMap.get(engine.modelSlug) ?? keySpecsMap.get(engine.id) ?? null;
  const pricePerSecondLabel = isImageEngine ? null : await buildPricePerSecondLabel(pricingEngine, locale);
  const pricePerImageLabel = isImageEngine ? await buildPricePerImageLabel(pricingEngine, locale) : null;
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
  const fallbackPriceRows: KeySpecRow[] = !showPriceInSpecs
    ? []
    : priceRows.length
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
      pricingEngine={pricingEngine}
      isVideoEngine={isVideoEngine}
      isImageEngine={isImageEngine}
      showBenchmarkLink={showBenchmarkLink}
      heroMedia={heroMedia}
      demoMedia={demoMedia}
      galleryVideos={galleryVideos}
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
  const model = resolveRuntimePublicSlug(slug);
  if (!model || !isRuntimeModelPagePublished(model)) {
    notFound();
  }

  if (slug !== model.slug) {
    permanentRedirect(`/${localizedModelsBase}/${model.slug}`.replace(/\/{2,}/g, '/'));
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
    const localizedContent = await getEngineLocalized(model.slug, activeLocale);
    if (model.lifecycle === 'deep_legacy' && localizedContent.archive) {
      return <ModelArchivePage model={model} value={localizedContent.archive} locale={activeLocale} />;
    }
    if (
      isRuntimePresentationOnlyModel(model) ||
      isPrelaunchModelPageTemplateSlug(model.slug)
    ) {
      return await renderMarketingModelPrelaunchPage({
        model,
        detailCopy,
        localizedContent,
        locale: activeLocale,
      });
    }

    const engine = getFalEngineBySlug(model.slug);
    if (!isPublishedModelPage(engine)) {
      notFound();
    }
    return await renderMarketingModelPage({
      engine,
      detailCopy,
      localizedContent,
      locale: activeLocale,
    });
  }
}
