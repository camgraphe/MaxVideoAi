import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { resolveDictionary } from '@/lib/i18n/server';
import { listFalEngines, getFalEngineBySlug, type FalEngineEntry } from '@/config/falEngines';
import { locales, type AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveLocalesForEnglishPath } from '@/lib/seo/alternateLocales';
import { getEngineLocalized, type EngineLocalizedContent } from '@/lib/models/i18n';
import { normalizeEngineId } from '@/lib/engine-alias';
import { listPlaylistVideos, getPublicVideosByIds, type GalleryVideo } from '@/server/videos';
import { applyEnginePricingOverride } from '@/lib/pricing-definition';
import { listEnginePricingOverrides } from '@/server/engine-settings';
import { loadBenchmarkScoreSlugs } from '@/server/benchmark-lab-data';
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
import { loadEngineKeySpecs } from './_lib/model-page-key-specs';
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

type PageParams = {
  params: Promise<{
    locale: AppLocale;
    slug: string;
  }>;
};

export const dynamicParams = false;
export const revalidate = 300;

const UNBRANDED_MODEL_TITLE_SLUGS = new Set(['pika-text-to-video', 'ltx-2-3-fast', 'seedance-2-0', 'veo-3-1']);

export function generateStaticParams() {
  const engines = listFalEngines();
  return locales.flatMap((locale) =>
    engines
      .filter(isPublishedModelPage)
      .map((entry) => ({ locale, slug: entry.modelSlug }))
  );
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const params = await props.params;
  const { slug, locale } = params;
  const engine = getFalEngineBySlug(slug);
  if (!isPublishedModelPage(engine)) {
    return {
      title: 'Model not found - MaxVideo AI',
      robots: { index: false, follow: false },
    };
  }

  const canonicalSlug = engine.modelSlug ?? slug;
  const localized = await getEngineLocalized(canonicalSlug, locale);
  const decisionData = buildModelDecisionData({
    engine,
    locale,
    decisionContent: localized.decision,
  });
  const detailSlugMap = buildDetailSlugMap(canonicalSlug);
  const publishableLocales = Array.from(resolveLocalesForEnglishPath(`/models/${canonicalSlug}`));
  const fallbackTitle = engine.seo.title ?? `${engine.marketingName} — MaxVideo AI`;
  const title = decisionData?.meta.title ?? localized.seo.title ?? fallbackTitle;
  const description =
    decisionData?.meta.description ??
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
  const benchmarkScoreSlugs = await loadBenchmarkScoreSlugs();
  const showBenchmarkLink = isVideoEngine && benchmarkScoreSlugs.has(engine.modelSlug);
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
  const safeSoraExamples =
    engine.modelSlug === 'sora-2'
      ? soraExamples.filter((video) => {
          const text = [video.prompt, video.promptExcerpt, video.id].filter(Boolean).join(' ');
          return !/\b(john\s+lennon|lennon|beatles)\b/i.test(text);
        })
      : soraExamples;
  const validatedMap = await getPublicVideosByIds(safeSoraExamples.map((video) => video.id));
  let galleryVideos = safeSoraExamples
    .filter((video) => validatedMap.has(video.id))
    .map((video) =>
      toGalleryCard(
        video,
        engine.brandId,
        localizedContent.marketingName ?? engine.marketingName,
        engine.modelSlug,
        engine.id,
        backPath,
        appPath
      )
    )
    .map((card) => resolveGalleryCardHref(card));

  const featuredExampleIds = FEATURED_EXAMPLE_MEDIA[engine.modelSlug] ?? [];
  const missingFeaturedExamples = featuredExampleIds.filter((id) => !galleryVideos.some((video) => video.id === id));
  if (featuredExampleIds.length) {
    const existingFeaturedCards = new Map(galleryVideos.map((video) => [video.id, video]));
    const fetchedFeaturedCards = new Map<string, (typeof galleryVideos)[number]>();
    if (missingFeaturedExamples.length) {
      const featuredMap = await getPublicVideosByIds(missingFeaturedExamples);
      for (const video of featuredMap.values()) {
        fetchedFeaturedCards.set(
          video.id,
          resolveGalleryCardHref(
            toGalleryCard(
              video,
              engine.brandId,
              localizedContent.marketingName ?? engine.marketingName,
              engine.modelSlug,
              engine.id,
              backPath,
              appPath
            )
          )
        );
      }
    }
    const featuredCards: typeof galleryVideos = [];
    for (const id of featuredExampleIds) {
      const card = existingFeaturedCards.get(id) ?? fetchedFeaturedCards.get(id);
      if (card) featuredCards.push(card);
    }
    if (featuredCards.length) {
      galleryVideos = [
        ...featuredCards,
        ...galleryVideos.filter((video) => !featuredExampleIds.includes(video.id)),
      ];
    }
  }

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
          engine.id,
          backPath,
          appPath
        )
      ];
    }
  }
  if (!appGenerationEnabled) {
    galleryVideos = galleryVideos.map((card) => resolveGalleryCardHref(card));
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
  if (engine.modelSlug === 'veo-3-1-fast') {
    const promptOverrides = new Map<string, string>([
      [
        'job_e34e8979-9056-4564-bbfd-27e8d886fa26',
        '8s 16:9 Veo 3.1 Fast desk draft with a presenter, slow handheld drift, soft typing, city ambience, and one short calm line.',
      ],
      [
        'job_3ee52c57-e023-4e98-9b45-c3ec7b60edf5',
        'Veo 3.1 Fast portrait interview draft of a man speaking about happiness, audio on, 16:9.',
      ],
    ]);
    galleryVideos = galleryVideos.map((video) => {
      const prompt = promptOverrides.get(video.id);
      return prompt ? { ...video, prompt, promptFull: prompt } : video;
    });
  }

  const modelName = localizedContent.marketingName ?? engine.marketingName;
  const fallbackMedia: FeaturedMedia = {
    id: `${engine.modelSlug}-hero-fallback`,
    prompt:
      engine.type === 'image'
        ? `${modelName} demo still from MaxVideoAI`
        : `${modelName} demo clip from MaxVideoAI`,
    videoUrl: engine.type === 'image' ? null : (normalizeMediaUrl(engine.media?.videoUrl) ?? normalizeMediaUrl(engine.demoUrl)),
    posterUrl: normalizeMediaUrl(engine.media?.imagePath),
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
  let demoMedia = pickDemoMedia(galleryVideos, heroMedia?.id ?? null, preferredIds.demo, fallbackMedia, {
    allowFallbackReuse: engine.modelSlug === 'happy-horse-1-1',
  });
  if (engine.modelSlug === 'sora-2-pro') {
    demoMedia = heroMedia;
  }
  if (engine.modelSlug === 'minimax-hailuo-02-text' && demoMedia) {
    demoMedia.prompt =
      '10s silent Hailuo 02 draft in 16:9. A cyclist rides through a shallow puddle on an empty concrete path; water splashes outward and the jacket fabric reacts to the motion. Low side tracking shot with one smooth push-in, natural dusk light, simple background, physics-focused movement, no dialogue or audio.';
  }
  const galleryCtaHref = appGenerationEnabled
    ? heroMedia?.id
      ? `${appPath}?engine=${engine.id}&from=${encodeURIComponent(heroMedia.id)}`
      : `${appPath}?engine=${engine.id}`
    : fallbackMarketingHref;
  const compareEngines = pickCompareEngines(listFalEngines(), engine.modelSlug);
  const faqEntries = localizedContent.faqs.length ? localizedContent.faqs : copy.faqs;
  const showPriceInSpecs = engine.id !== 'lumaRay2';
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
  const engine = getFalEngineBySlug(slug);
  if (!isPublishedModelPage(engine)) {
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
