import clsx from 'clsx';
import type { Metadata } from 'next';
import Link from 'next/link';
import { permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExampleFamilyPage, listExamples, listExamplesPage, type ExampleSort } from '@/server/videos';
import { ExamplesGalleryGrid, type ExampleGalleryVideo } from '@/components/examples/ExamplesGalleryGrid';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { buildOptimizedPosterUrl } from '@/lib/media-helpers';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import {
  getExampleModelLanding,
  getHubExamplesFaq,
} from '@/lib/examples/modelLanding';
import { pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import {
  ALLOWED_QUERY_KEYS,
  CURRENT_ENGINE_MODEL_LINKS_BY_GROUP,
  DEFAULT_SORT,
  ENGINE_META,
  ENGINE_MODEL_LINKS,
  ENGINE_MODEL_LINKS_BY_GROUP,
  EXAMPLES_PAGE_SIZE,
  FAMILY_INITIAL_DESKTOP_GALLERY_BATCH,
  GALLERY_POSTER_OPTIONS,
  GALLERY_SLUG_MAP,
  HERO_POSTER_OPTIONS,
  HUB_INITIAL_DESKTOP_GALLERY_BATCH,
  INITIAL_MOBILE_GALLERY_BATCH,
  PREFERRED_ENGINE_ORDER,
  SITE,
  appendTrackingParams,
  buildLocalizedExampleLabel,
  buildMainVideoHeroLine,
  buildModelHref,
  buildPricingHref,
  compactLeadCopy,
  formatModelSlugLabel,
  formatPromptExcerpt,
  getAspectRatioStyle,
  getEngineAccentOutlineStyle,
  getPlaceholderPoster,
  getSort,
  getVideoMimeType,
  isPortraitAspectRatio,
  isTrackingParam,
  normalizeFilterId,
  resolveCanonicalEngineParam,
  resolveEngineLabel,
  resolveEngineLinkId,
  resolveFilterDescriptor,
  serializeJsonLd,
  toAbsoluteUrl,
  type EngineFilterOption,
} from './_lib/examples-route-utils';
import {
  getExampleFamilyDescriptor,
} from '@/lib/model-families';
import { ExamplesMainVideoFeature } from './_components/examples-main-video-feature';
import {
  buildExamplesNextStepLinks,
  getExamplesBrowseByModelLabel,
  getExamplesGalleryUiCopy,
  getExamplesLongDescription,
  getExamplesMainVideoCopy,
  getExamplesModelPageLabels,
  getKlingExamplesSectionTitles,
} from './_lib/examples-page-copy';

export async function generateMetadata(
  props: {
    params: Promise<{ locale: AppLocale }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
  }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = params.locale;
  const t = await getTranslations({ locale, namespace: 'gallery.meta' });
  const collapsedEngineParam = resolveCanonicalEngineParam(searchParams.engine);
  const engineLabel = resolveEngineLabel(searchParams.engine);
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const hasNonDefaultSort = sort !== DEFAULT_SORT;
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : NaN;
  const normalizedPage = Number.isFinite(parsedPage) && parsedPage > 1 ? parsedPage : null;
  const latest = await listExamples('date-desc', 20);
  const firstWithThumb = latest.find((video) => Boolean(video.thumbUrl));
  const ogImage = toAbsoluteUrl(firstWithThumb?.thumbUrl) ?? `${SITE}/og/price-before.png`;
  const canonicalExampleSlug = resolveExampleCanonicalSlug(collapsedEngineParam);
  const hasPaginatedView = Boolean(normalizedPage && normalizedPage > 1);
  const shouldNoindex =
    hasNonDefaultSort || hasPaginatedView || Boolean(collapsedEngineParam && !canonicalExampleSlug);
  const effectiveEngineLabel = canonicalExampleSlug ? engineLabel : null;
  const title = effectiveEngineLabel ? t('title_engine', { engineName: effectiveEngineLabel }) : t('title');
  const description = effectiveEngineLabel
    ? t('description_engine', { engineName: effectiveEngineLabel })
    : t('description');

  if (canonicalExampleSlug) {
    return buildSeoMetadata({
      locale,
      title,
      description,
      englishPath: `/examples/${canonicalExampleSlug}`,
      image: ogImage,
      imageAlt: 'MaxVideo AI — Examples gallery preview',
      robots: {
        index: !shouldNoindex,
        follow: true,
      },
    });
  }

  const metadataUrls = buildMetadataUrls(locale, GALLERY_SLUG_MAP, { englishPath: '/examples' });
  return buildSeoMetadata({
    locale,
    title,
    description,
    hreflangGroup: 'examples',
    slugMap: GALLERY_SLUG_MAP,
    image: ogImage,
    imageAlt: 'MaxVideo AI — Examples gallery preview',
    canonicalOverride: metadataUrls.canonical,
    robots: {
      index: !shouldNoindex,
      follow: true,
    },
  });
}

type ExamplesPageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Record<string, string | string[] | undefined>;
};

// Labels will be localized from dictionary at render time

export const revalidate = 60;

export default async function ExamplesPage(props: ExamplesPageProps) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const internalEngineFromPath = Array.isArray(searchParams.__engineFromPath)
    ? searchParams.__engineFromPath[0]
    : searchParams.__engineFromPath;
  const engineFromPath =
    typeof internalEngineFromPath === 'string' && internalEngineFromPath.trim().length
      ? internalEngineFromPath.trim().toLowerCase()
      : '';
  const { locale, dictionary } = await resolveDictionary({ locale: params.locale });
  const appLocale = locale as AppLocale;
  const content = dictionary.examples;
  const modelLanding = engineFromPath ? getExampleModelLanding(appLocale, engineFromPath) : null;
  const isModelLanding = Boolean(modelLanding);
  const hubFaq = getHubExamplesFaq(appLocale);
  const faqBlock = modelLanding
    ? { title: modelLanding.faqTitle, items: modelLanding.faqItems }
    : { title: hubFaq.title, items: hubFaq.items };
  const engineFilterAllLabel = (content as { engineFilterAllLabel?: string })?.engineFilterAllLabel ?? 'All';
  const paginationContent =
    (content as { pagination?: { prev?: string; next?: string; page?: string; loadMore?: string } })?.pagination ?? {};
  const browseByModelLabel = getExamplesBrowseByModelLabel(appLocale);
  const galleryUiCopy = getExamplesGalleryUiCopy(appLocale, paginationContent);
  const paginationPrevLabel = galleryUiCopy.prev;
  const paginationNextLabel = galleryUiCopy.next;
  const paginationPageLabel = galleryUiCopy.page;
  const loadMoreLabel = galleryUiCopy.loadMore;
  const longDescription = getExamplesLongDescription(appLocale);
  const HERO_BODY_FALLBACK =
    'Browse AI video examples by model with prompt, format, duration, and price per clip. Use filters to review outputs and open model pages for specs and limits.';
  const hubHeroBody =
    typeof content.hero?.body === 'string' && content.hero.body.trim().length ? content.hero.body : HERO_BODY_FALLBACK;
  const isSeedanceLanding = modelLanding?.slug === 'seedance';
  const isKlingLanding = modelLanding?.slug === 'kling';
  const isVeoLanding = modelLanding?.slug === 'veo';
  const isLtxLanding = modelLanding?.slug === 'ltx';
  const heroTitle = modelLanding?.heroTitle ?? content.hero.title;
  const heroSubtitle = modelLanding?.heroSubtitle ?? content.hero.subtitle;
  const heroBody = (modelLanding?.intro ?? hubHeroBody).replace(/\s+/g, ' ').trim();
  const heroLead = modelLanding ? heroBody : compactLeadCopy(heroBody, 152);
  const klingSectionTitles = getKlingExamplesSectionTitles(appLocale, isKlingLanding);
  const modelLandingSections = modelLanding?.sections.map((section, index) => ({
    ...section,
    title: klingSectionTitles?.[index] ?? section.title,
    body: compactLeadCopy(section.body, 86),
  }));
  const sortParam = Array.isArray(searchParams.sort) ? searchParams.sort[0] : searchParams.sort;
  const sort = getSort(sortParam);
  const collapsedEngineParam = resolveCanonicalEngineParam(searchParams.engine);
  const pageParam = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = (() => {
    if (typeof pageParam !== 'string' || pageParam.trim().length === 0) {
      return 1;
    }
    const value = Number.parseInt(pageParam, 10);
    return Number.isFinite(value) ? value : Number.NaN;
  })();
  const hasInvalidPageParam = typeof pageParam !== 'undefined' && (!Number.isFinite(parsedPage) || parsedPage < 1);
  const currentPage = hasInvalidPageParam ? 1 : Math.max(1, parsedPage || 1);
  const localePrefix = localePathnames[locale] ? `/${localePathnames[locale]}` : '';
  const gallerySegment = GALLERY_SLUG_MAP[locale] ?? GALLERY_SLUG_MAP.en ?? 'examples';
  const galleryBasePath = `${localePrefix}/${gallerySegment}`.replace(/\/{2,}/g, '/');

  const redirectToNormalized = (targetPage: number) => {
    const normalizedBasePath =
      engineFromPath && modelLanding ? `${galleryBasePath}/${modelLanding.slug}` : galleryBasePath;
    const redirectedQuery = new URLSearchParams();
    appendTrackingParams(redirectedQuery, searchParams);
    if (sort !== DEFAULT_SORT) {
      redirectedQuery.set('sort', sort);
    }
    if (targetPage > 1) {
      redirectedQuery.set('page', String(targetPage));
    }
    const target = redirectedQuery.toString()
      ? `${normalizedBasePath}?${redirectedQuery.toString()}`
      : normalizedBasePath;
    permanentRedirect(target);
  };

  if (hasInvalidPageParam) {
    redirectToNormalized(1);
  }

  const canonicalExampleSlug = resolveExampleCanonicalSlug(collapsedEngineParam);
  if (collapsedEngineParam && !engineFromPath) {
    if (canonicalExampleSlug) {
      const redirectedQuery = new URLSearchParams();
      appendTrackingParams(redirectedQuery, searchParams);
      if (sort !== DEFAULT_SORT) {
        redirectedQuery.set('sort', sort);
      }
      if (currentPage > 1) {
        redirectedQuery.set('page', String(currentPage));
      }
      const target = redirectedQuery.toString()
        ? `${galleryBasePath}/${canonicalExampleSlug}?${redirectedQuery.toString()}`
        : `${galleryBasePath}/${canonicalExampleSlug}`;
      permanentRedirect(target);
    }
    redirectToNormalized(currentPage);
  }

  const unsupportedQueryKeys = Object.keys(searchParams).filter(
    (key) => !ALLOWED_QUERY_KEYS.has(key) && !isTrackingParam(key)
  );
  if (unsupportedQueryKeys.length > 0) {
    redirectToNormalized(currentPage);
  }

  const offset = (currentPage - 1) * EXAMPLES_PAGE_SIZE;
  const pageResult =
    engineFromPath && collapsedEngineParam
      ? await listExampleFamilyPage(collapsedEngineParam, {
          sort,
          limit: EXAMPLES_PAGE_SIZE,
          offset,
        })
      : await listExamplesPage({
          sort,
          limit: EXAMPLES_PAGE_SIZE,
          offset,
          engineGroup: collapsedEngineParam || undefined,
        });
  const allVideos = pageResult.items;
  const totalCount = pageResult.total;
  const totalPages = Math.max(1, Math.ceil(totalCount / EXAMPLES_PAGE_SIZE));
  const displayTotalPages = Math.max(totalPages, currentPage);

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
      ? engineFilterOptions.find((option) => option.key === normalizeFilterId(collapsedEngineParam))
      : null;
  const selectedEngine = selectedOption?.id ?? null;
  const modelSlugs = selectedEngine
    ? ENGINE_MODEL_LINKS_BY_GROUP[selectedEngine.toLowerCase()] ?? []
    : [];
  const modelLinks = modelSlugs.map((slug) => {
    const label = ENGINE_META.get(slug)?.label ?? formatModelSlugLabel(slug);
    return {
      slug,
      label,
      href: buildModelHref(locale as AppLocale, slug),
    };
  });
  const usesCurrentAndSupportedBlocks = isSeedanceLanding || isKlingLanding || isLtxLanding;
  const currentModelSlugs = selectedEngine
    ? CURRENT_ENGINE_MODEL_LINKS_BY_GROUP[selectedEngine.toLowerCase()] ?? []
    : [];
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
  const pricingPath = buildPricingHref(locale as AppLocale);
  const {
    currentModelPagesLabel,
    modelPagesLabel,
    pricingLinkLabel,
    supportedOlderVersionLabel,
  } = getExamplesModelPageLabels({
    isKlingLanding,
    isLtxLanding,
    locale: appLocale,
  });
  const nextStepLinks = buildExamplesNextStepLinks({
    appLocale,
    isKlingLanding,
    isLtxLanding,
    isSeedanceLanding,
    isVeoLanding,
    locale: appLocale,
    pricingPath,
  });

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
        .filter((entry): entry is { video: typeof allVideos[number]; index: number } => Boolean(entry))
    : allVideos.map((video, index) => ({ video, index }));
  const videos = filteredEntries.map((entry) => entry.video);
  const clientVideos: ExampleGalleryVideo[] = filteredEntries.map(({ video, index }) => {
    const canonicalEngineId = resolveEngineLinkId(video.engineId);
    const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
    const engineMeta = engineKey ? ENGINE_META.get(engineKey) ?? null : null;
    const descriptor = canonicalEngineId ? resolveFilterDescriptor(canonicalEngineId, engineMeta) : null;
    const modelSlug =
      engineMeta?.modelSlug ?? (descriptor ? ENGINE_MODEL_LINKS[descriptor.id.toLowerCase()] : null);
    const modelHref = modelSlug ? buildModelHref(locale as AppLocale, modelSlug) : null;
    const promptDisplay =
      locale === 'en'
        ? formatPromptExcerpt(video.promptExcerpt || video.prompt || 'MaxVideoAI render')
        : buildLocalizedExampleLabel(
            locale as AppLocale,
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
  });
  const showModelHero = isModelLanding && currentPage === 1 && sort === DEFAULT_SORT;
  const playableHeroCard = showModelHero ? pickFirstPlayableVideo(clientVideos) : null;
  const mainVideoIndex = playableHeroCard ? clientVideos.indexOf(playableHeroCard) : -1;
  const mainVideo =
    mainVideoIndex >= 0
      ? {
          video: videos[mainVideoIndex],
          card: clientVideos[mainVideoIndex],
        }
      : null;
  const galleryVideos = mainVideo ? videos.filter((_, index) => index !== mainVideoIndex) : videos;
  const galleryClientVideos = mainVideo ? clientVideos.filter((_, index) => index !== mainVideoIndex) : clientVideos;
  const initialDesktopBatch = isModelLanding ? FAMILY_INITIAL_DESKTOP_GALLERY_BATCH : HUB_INITIAL_DESKTOP_GALLERY_BATCH;
  const initialExamples = galleryClientVideos.slice(0, initialDesktopBatch);
  const initialMaxIndex = initialExamples.reduce((max, video) => Math.max(max, video.sourceIndex ?? -1), -1);
  const pageOffsetStart = offset;
  const pageOffsetEnd = offset + allVideos.length;
  const consumedMaxIndex = Math.max(mainVideo?.card.sourceIndex ?? -1, initialMaxIndex);
  const nextOffsetStart = pageOffsetStart + Math.max(0, consumedMaxIndex + 1);
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const showGallerySection = galleryClientVideos.length > 0 || nextOffsetStart < pageOffsetEnd;
  const buildQueryParams = (
    nextSort: ExampleSort,
    engineValue: string | null,
    pageValue?: number
  ): Record<string, string> | undefined => {
    const query: Record<string, string> = {};
    if (nextSort !== DEFAULT_SORT) {
      query.sort = nextSort;
    }
    if (engineValue && !engineFromPath) {
      query.engine = engineValue;
    }
    if (pageValue && pageValue > 1) {
      query.page = String(pageValue);
    }
    return Object.keys(query).length ? query : undefined;
  };
  const buildEngineFilterHref = (engineId: string | null): string => {
    if (!engineId) {
      return galleryBasePath;
    }
    const canonicalSlug = resolveExampleCanonicalSlug(engineId);
    if (canonicalSlug) {
      return `${galleryBasePath}/${canonicalSlug}`;
    }
    const query = new URLSearchParams();
    query.set('engine', engineId);
    const suffix = query.toString();
    return suffix ? `${galleryBasePath}?${suffix}` : galleryBasePath;
  };
  const buildPaginationHref = (targetPage: number) => {
    const query = buildQueryParams(sort, selectedEngine, targetPage);
    if (engineFromPath && modelLanding) {
      const modelPath = `${galleryBasePath}/${modelLanding.slug}`;
      if (!query) return modelPath;
      const params = new URLSearchParams(query);
      const suffix = params.toString();
      return suffix ? `${modelPath}?${suffix}` : modelPath;
    }
    return {
      pathname: '/examples' as const,
      query,
    };
  };

  const itemListElements = galleryVideos.map((video, index) => {
      const canonicalEngineId = resolveEngineLinkId(video.engineId);
      const engineKey = canonicalEngineId?.toLowerCase() ?? video.engineId?.toLowerCase() ?? '';
      const engineMeta = engineKey ? ENGINE_META.get(engineKey) : null;
      const engineLabel = engineMeta?.label ?? video.engineLabel ?? canonicalEngineId ?? 'Engine';
      const detailPath = `/video/${encodeURIComponent(video.id)}`;
      const absoluteUrl = `${SITE}${detailPath}`;
      const fallbackLabel = `MaxVideoAI example ${video.id}`;
      const name =
        locale === 'en'
          ? video.promptExcerpt || video.prompt || `${engineLabel} video example` || fallbackLabel
          : buildLocalizedExampleLabel(locale as AppLocale, engineLabel, video.aspectRatio ?? null, video.durationSec);
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: absoluteUrl,
        name: name || fallbackLabel,
      };
    });

  const baseExamplesUrl = `${SITE}${galleryBasePath}`;
  const canonicalUrl = modelLanding
    ? `${SITE}${galleryBasePath}/${modelLanding.slug}`
    : baseExamplesUrl;
  const mainVideoModelLabel = modelLanding?.label ?? selectedOption?.label ?? mainVideo?.card.engineLabel ?? 'Model';
  const mainVideoTitle =
    locale === 'en'
      ? mainVideo?.video.promptExcerpt ||
        mainVideo?.video.prompt ||
        `${mainVideoModelLabel} example video`
      : buildLocalizedExampleLabel(
          locale as AppLocale,
          mainVideoModelLabel,
          mainVideo?.video.aspectRatio ?? mainVideo?.card.aspectRatio ?? null,
          mainVideo?.video.durationSec ?? null
        );
  const mainVideoPromptFull = locale === 'en' ? mainVideo?.video.prompt?.trim() || null : null;
  const mainVideoHeroLine = mainVideo
    ? buildMainVideoHeroLine(
        locale as AppLocale,
        mainVideoModelLabel,
        modelLanding?.heroSubtitle ?? modelLanding?.summary ?? null
      )
    : null;
  const mainVideoContentUrl = mainVideo ? toAbsoluteUrl(mainVideo.video.videoUrl ?? null) : null;
  const mainVideoPoster =
    mainVideo?.card.heroPosterUrl ?? mainVideo?.card.optimizedPosterUrl ?? mainVideo?.card.rawPosterUrl ?? null;
  const mainVideoAspectRatio = getAspectRatioStyle(mainVideo?.video.aspectRatio ?? mainVideo?.card.aspectRatio ?? null);
  const mainVideoIsPortrait = isPortraitAspectRatio(mainVideo?.video.aspectRatio ?? mainVideo?.card.aspectRatio ?? null);
  const mainVideoMimeType = getVideoMimeType(mainVideoContentUrl);
  const breadcrumbLabels = getBreadcrumbLabels(appLocale);
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: breadcrumbLabels.home,
      item: `${SITE}${localePrefix || ''}`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: breadcrumbLabels.examples,
      item: baseExamplesUrl,
    },
  ];
  if (modelLanding) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: modelLanding.label,
      item: canonicalUrl,
    });
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  };

  const itemListJson =
    itemListElements.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: modelLanding
            ? `AI video examples for ${modelLanding.label} on MaxVideoAI`
            : 'AI video examples on MaxVideoAI',
          numberOfItems: itemListElements.length,
          itemListOrder: 'https://schema.org/ItemListOrderAscending',
          url: canonicalUrl,
          itemListElement: itemListElements,
        }
      : null;
  const faqJsonLd = faqBlock.items.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqBlock.items.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
        }
      : null;
  const mainVideoCopy = getExamplesMainVideoCopy(appLocale);

  return (
    <>
      {engineFilterOptions.length ? (
        <div className="sticky top-16 z-[35] -mt-px border-b border-hairline bg-surface">
          <div className="container-page max-w-6xl">
            <nav
              aria-label={browseByModelLabel}
              className="flex flex-col gap-2 py-2 lg:flex-row lg:items-center lg:gap-4 lg:py-2"
            >
              <span className="shrink-0 pl-1 text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                {browseByModelLabel}
              </span>

              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(5.75rem,1fr))] gap-1 rounded-xl bg-surface-2/70 p-1 sm:grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] lg:grid-flow-col lg:auto-cols-fr lg:grid-cols-none">
                  <Link
                    href={buildEngineFilterHref(null)}
                    scroll={false}
                    prefetch={false}
                    className={clsx(
                      'flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:px-3 sm:text-sm',
                      selectedEngine
                        ? 'text-text-secondary hover:bg-surface hover:text-text-primary'
                        : 'bg-surface text-text-primary shadow-sm ring-1 ring-black/5'
                    )}
                  >
                    {engineFilterAllLabel}
                  </Link>
                  {engineFilterOptions.map((engine) => {
                    const isActive = selectedEngine === engine.id;
                    const activeAccentStyle = isActive ? getEngineAccentOutlineStyle(engine.brandId) : undefined;
                    return (
                      <Link
                        key={engine.id}
                        href={buildEngineFilterHref(engine.id)}
                        scroll={false}
                        prefetch={false}
                        className={clsx(
                          'flex h-9 items-center justify-center whitespace-nowrap rounded-lg px-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:px-3 sm:text-sm',
                          isActive
                            ? 'bg-surface text-text-primary shadow-sm ring-1 ring-black/5'
                            : 'text-text-secondary hover:bg-surface hover:text-text-primary'
                        )}
                        style={activeAccentStyle}
                      >
                        {engine.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>
        </div>
      ) : null}

      <main
        className={clsx(
          'container-page max-w-7xl',
          engineFilterOptions.length ? 'pb-[var(--section-padding-y)] pt-4 sm:pt-6' : 'section'
        )}
      >
        <div className="stack-gap-lg">
          <section className="halo-hero stack-gap-sm text-center sm:stack-gap-md">
            <header className="mx-auto max-w-3xl stack-gap-sm text-center">
              <h1 className="text-3xl font-semibold text-text-primary sm:text-5xl">{heroTitle}</h1>
              <p className="text-base leading-relaxed text-text-secondary">{heroSubtitle}</p>
              <p className="mx-auto max-w-2xl text-sm leading-relaxed text-text-secondary/90">{heroLead}</p>
            </header>
          </section>

          {mainVideo && mainVideoContentUrl ? (
            <ExamplesMainVideoFeature
              aspectRatio={mainVideoAspectRatio}
              contentUrl={mainVideoContentUrl}
              copy={mainVideoCopy}
              durationSec={mainVideo.video.durationSec}
              engineLabel={mainVideo.card.engineLabel}
              exampleHref={mainVideo.card.href}
              hasAudio={mainVideo.video.hasAudio}
              heroLine={mainVideoHeroLine}
              isPortrait={mainVideoIsPortrait}
              locale={locale}
              mimeType={mainVideoMimeType}
              modelHref={mainVideo.card.modelHref ?? null}
              poster={mainVideoPoster ?? null}
              promptFull={mainVideoPromptFull}
              title={mainVideoTitle}
            />
          ) : null}

          {isModelLanding && selectedEngine && modelLinks.length ? (
            <section className="mx-auto max-w-5xl">
              <div className="flex flex-col items-center gap-3 text-sm text-text-secondary">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                    {usesCurrentAndSupportedBlocks ? currentModelPagesLabel : modelPagesLabel}
                  </span>
                  {primaryModelLinks.map((model) => (
                    <Link key={model.slug} href={model.href} className="font-semibold text-brand hover:text-brandHover">
                      {model.label}
                    </Link>
                  ))}
                  <Link href={pricingPath} className="font-semibold text-brand hover:text-brandHover">
                    {pricingLinkLabel}
                  </Link>
                </div>
                {supportedOlderModelLinks.length ? (
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                      {supportedOlderVersionLabel}
                    </span>
                    {supportedOlderModelLinks.map((model) => (
                      <Link key={model.slug} href={model.href} className="font-semibold text-brand hover:text-brandHover">
                        {model.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {modelLandingSections?.length ? (
            <section className="grid gap-3 md:grid-cols-3">
              {modelLandingSections.map((section) => (
                <article
                  key={section.title}
                  className="rounded-[20px] border border-hairline/80 bg-surface/85 px-4 py-4 text-left shadow-sm"
                >
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-tight text-text-primary">{section.title}</h2>
                    <p
                      className="mt-2 text-xs leading-relaxed text-text-secondary/90"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {section.body}
                    </p>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          {showGallerySection ? (
            <section className="overflow-hidden rounded-[12px] border border-hairline bg-surface/80 shadow-card">
              <ExamplesGalleryGrid
                initialExamples={initialExamples}
                loadMoreLabel={loadMoreLabel}
                loadingLabel={galleryUiCopy.loading}
                noPreviewLabel={galleryUiCopy.noPreview}
                audioAvailableLabel={galleryUiCopy.audioAvailable}
                initialDesktopBatch={initialDesktopBatch}
                initialMobileBatch={INITIAL_MOBILE_GALLERY_BATCH}
                sort={sort}
                engineFilter={selectedEngine?.toLowerCase() ?? null}
                initialOffset={nextOffsetStart}
                pageOffsetEnd={pageOffsetEnd}
                locale={locale}
              />
            </section>
          ) : null}

          {modelLanding && heroLead !== heroBody ? (
            <section className="mx-auto max-w-4xl text-sm leading-relaxed text-text-secondary/90">
              <p>{heroBody}</p>
            </section>
          ) : null}

          {totalPages > 1 ? (
            <nav className="flex flex-col items-center justify-between gap-4 rounded-[24px] border border-hairline bg-surface/70 px-4 py-4 text-sm text-text-secondary sm:flex-row">
              <div>
                {hasPreviousPage ? (
                  <Link
                    href={buildPaginationHref(currentPage - 1)}
                    rel="prev"
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    ← {paginationPrevLabel}
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-dashed border-hairline px-3 py-1 text-text-muted">
                    ← {paginationPrevLabel}
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">
                {paginationPageLabel} {currentPage} / {displayTotalPages}
              </span>
              <div>
                {hasNextPage ? (
                  <Link
                    href={buildPaginationHref(currentPage + 1)}
                    rel="next"
                    className="inline-flex items-center rounded-full border border-hairline px-3 py-1 font-medium text-text-primary transition hover:border-text-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {paginationNextLabel} →
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-dashed border-hairline px-3 py-1 text-text-muted">
                    {paginationNextLabel} →
                  </span>
                )}
              </div>
            </nav>
          ) : null}

          {!modelLanding ? (
            <section className="max-w-4xl text-sm leading-relaxed text-text-secondary/90">
              <p>{longDescription}</p>
            </section>
          ) : (
            <section className="max-w-4xl text-sm leading-relaxed text-text-secondary/90">
              <p>{modelLanding.summary}</p>
            </section>
          )}

          <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
            <h2 className="text-lg font-semibold text-text-primary">
              {locale === 'fr'
                ? 'Aller plus loin'
                : locale === 'es'
                  ? 'Siguientes pasos'
                  : 'Next steps'}
            </h2>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {nextStepLinks.map((item) => (
                <Link key={item.label} href={item.href} className="font-semibold text-brand hover:text-brandHover">
                  {item.label}
                </Link>
              ))}
            </div>
          </section>

          {faqBlock.items.length ? (
            <section className="rounded-[16px] border border-hairline bg-surface/80 px-5 py-5 shadow-card">
              <h2 className="text-lg font-semibold text-text-primary">{faqBlock.title}</h2>
              <div className="mt-4 space-y-3">
                {faqBlock.items.map((item) => (
                  <details key={item.question} className="rounded-lg border border-hairline bg-surface px-4 py-3">
                    <summary className="cursor-pointer text-sm font-semibold text-text-primary">{item.question}</summary>
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

        </div>

        {breadcrumbJsonLd ? (
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
          />
        ) : null}
        {itemListJson ? (
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(itemListJson) }}
          />
        ) : null}
        {faqJsonLd ? (
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
          />
        ) : null}
      </main>
    </>
  );
}
