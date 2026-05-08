import clsx from 'clsx';
import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExampleFamilyPage, listExamples, listExamplesPage, type ExampleSort } from '@/server/videos';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { getBreadcrumbLabels } from '@/lib/seo/breadcrumbs';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { getExampleModelLanding, getHubExamplesFaq } from '@/lib/examples/modelLanding';
import { pickFirstPlayableVideo } from '@/lib/examples/heroVideo';
import {
  ALLOWED_QUERY_KEYS,
  DEFAULT_SORT,
  ENGINE_META,
  EXAMPLES_PAGE_SIZE,
  FAMILY_INITIAL_DESKTOP_GALLERY_BATCH,
  GALLERY_SLUG_MAP,
  HUB_INITIAL_DESKTOP_GALLERY_BATCH,
  INITIAL_MOBILE_GALLERY_BATCH,
  SITE,
  appendTrackingParams,
  buildLocalizedExampleLabel,
  buildMainVideoHeroLine,
  buildPricingHref,
  compactLeadCopy,
  getAspectRatioStyle,
  getSort,
  getVideoMimeType,
  isPortraitAspectRatio,
  isTrackingParam,
  resolveCanonicalEngineParam,
  resolveEngineLabel,
  resolveEngineLinkId,
  toAbsoluteUrl,
} from './_lib/examples-route-utils';
import { ExamplesEngineFilterNav } from './_components/examples-engine-filter-nav';
import { ExamplesJsonLdScripts } from './_components/examples-jsonld-scripts';
import { ExamplesMainVideoFeature } from './_components/examples-main-video-feature';
import {
  ExamplesFaqSection,
  ExamplesGallerySection,
  ExamplesIntroHero,
  ExamplesModelLandingCardsSection,
  ExamplesModelLinksSection,
  ExamplesNextStepsSection,
  ExamplesPaginationNav,
  ExamplesSummarySection,
} from './_components/examples-route-sections';
import {
  buildExamplesNextStepLinks,
  getExamplesBrowseByModelLabel,
  getExamplesGalleryUiCopy,
  getExamplesLongDescription,
  getExamplesMainVideoCopy,
  getExamplesModelPageLabels,
  getKlingExamplesSectionTitles,
} from './_lib/examples-page-copy';
import {
  buildExamplesEngineFilterState,
  buildExamplesGalleryData,
  buildExamplesModelLinks,
} from './_lib/examples-page-data';

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

  const usesCurrentAndSupportedBlocks = isSeedanceLanding || isKlingLanding || isLtxLanding;
  const { engineFilterOptions, selectedEngine, selectedOption } = buildExamplesEngineFilterState({
    allVideos,
    collapsedEngineParam,
  });
  const { modelLinks, primaryModelLinks, supportedOlderModelLinks } = buildExamplesModelLinks({
    locale: appLocale,
    selectedEngine,
    usesCurrentAndSupportedBlocks,
  });
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

  const { videos, clientVideos } = buildExamplesGalleryData({
    allVideos,
    locale: appLocale,
    selectedEngine,
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
  const previousPageHref = buildPaginationHref(Math.max(1, currentPage - 1));
  const nextPageHref = buildPaginationHref(currentPage + 1);

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
      <ExamplesEngineFilterNav
        browseByModelLabel={browseByModelLabel}
        engineFilterAllLabel={engineFilterAllLabel}
        engineFilterOptions={engineFilterOptions}
        getEngineFilterHref={buildEngineFilterHref}
        selectedEngine={selectedEngine}
      />

      <main
        className={clsx(
          'container-page max-w-7xl',
          engineFilterOptions.length ? 'pb-[var(--section-padding-y)] pt-4 sm:pt-6' : 'section'
        )}
      >
        <div className="stack-gap-lg">
          <ExamplesIntroHero heroLead={heroLead} heroSubtitle={heroSubtitle} heroTitle={heroTitle} />

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

          <ExamplesModelLinksSection
            currentModelPagesLabel={currentModelPagesLabel}
            isModelLanding={isModelLanding}
            modelLinks={modelLinks}
            modelPagesLabel={modelPagesLabel}
            pricingLinkLabel={pricingLinkLabel}
            pricingPath={pricingPath}
            primaryModelLinks={primaryModelLinks}
            selectedEngine={selectedEngine}
            supportedOlderModelLinks={supportedOlderModelLinks}
            supportedOlderVersionLabel={supportedOlderVersionLabel}
            usesCurrentAndSupportedBlocks={usesCurrentAndSupportedBlocks}
          />

          <ExamplesModelLandingCardsSection sections={modelLandingSections} />

          <ExamplesGallerySection
            audioAvailableLabel={galleryUiCopy.audioAvailable}
            engineFilter={selectedEngine?.toLowerCase() ?? null}
            initialDesktopBatch={initialDesktopBatch}
            initialExamples={initialExamples}
            initialMobileBatch={INITIAL_MOBILE_GALLERY_BATCH}
            initialOffset={nextOffsetStart}
            loadMoreLabel={loadMoreLabel}
            loadingLabel={galleryUiCopy.loading}
            locale={locale}
            noPreviewLabel={galleryUiCopy.noPreview}
            pageOffsetEnd={pageOffsetEnd}
            show={showGallerySection}
            sort={sort}
          />

          {modelLanding && heroLead !== heroBody ? (
            <section className="mx-auto max-w-4xl text-sm leading-relaxed text-text-secondary/90">
              <p>{heroBody}</p>
            </section>
          ) : null}

          <ExamplesPaginationNav
            currentPage={currentPage}
            displayTotalPages={displayTotalPages}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            nextHref={nextPageHref}
            nextLabel={paginationNextLabel}
            pageLabel={paginationPageLabel}
            previousHref={previousPageHref}
            previousLabel={paginationPrevLabel}
            show={totalPages > 1}
          />

          <ExamplesSummarySection longDescription={longDescription} modelLandingSummary={modelLanding?.summary} />

          <ExamplesNextStepsSection locale={appLocale} nextStepLinks={nextStepLinks} />

          <ExamplesFaqSection faqBlock={faqBlock} />

        </div>

        <ExamplesJsonLdScripts
          breadcrumbJsonLd={breadcrumbJsonLd}
          faqJsonLd={faqJsonLd}
          itemListJson={itemListJson}
        />
      </main>
    </>
  );
}
