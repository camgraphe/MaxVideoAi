import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { resolveDictionary } from '@/lib/i18n/server';
import { listExampleFamilyPage, listExamples, listExamplesPage } from '@/server/videos';
import { localePathnames, type AppLocale } from '@/i18n/locales';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { resolveExampleCanonicalSlug } from '@/lib/examples-links';
import { getExampleModelLanding, getHubExamplesFaq } from '@/lib/examples/modelLanding';
import {
  ALLOWED_QUERY_KEYS,
  DEFAULT_SORT,
  EXAMPLES_PAGE_SIZE,
  GALLERY_SLUG_MAP,
  INITIAL_MOBILE_GALLERY_BATCH,
  SITE,
  buildPricingHref,
  compactLeadCopy,
  getSort,
  isTrackingParam,
  resolveCanonicalEngineParam,
  resolveEngineLabel,
  toAbsoluteUrl,
} from './_lib/examples-route-utils';
import { ExamplesPageView } from './_components/examples-page-view';
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
  buildExamplesGalleryPresentation,
  buildExamplesMainVideoFeatureData,
  buildExamplesModelLinks,
} from './_lib/examples-page-data';
import {
  buildExamplesEngineFilterHref,
  buildExamplesNormalizedRedirectTarget,
  buildExamplesPaginationHref,
} from './_lib/examples-page-hrefs';
import { buildExamplesJsonLd } from './_lib/examples-page-jsonld';

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
    titleBranding: locale === 'en' ? 'none' : 'auto',
    robots: {
      index: !shouldNoindex,
      follow: true,
    },
  });
}

type ExamplesPageProps = {
  params: Promise<{ locale: AppLocale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
    permanentRedirect(
      buildExamplesNormalizedRedirectTarget({
        engineFromPath,
        galleryBasePath,
        modelLandingSlug: modelLanding?.slug,
        searchParams,
        sort,
        targetPage,
      })
    );
  };

  if (hasInvalidPageParam) {
    redirectToNormalized(1);
  }

  const canonicalExampleSlug = resolveExampleCanonicalSlug(collapsedEngineParam);
  if (collapsedEngineParam && !engineFromPath) {
    if (canonicalExampleSlug) {
      permanentRedirect(
        buildExamplesNormalizedRedirectTarget({
          currentPage,
          engineFromPath: '',
          galleryBasePath: `${galleryBasePath}/${canonicalExampleSlug}`,
          searchParams,
          sort,
          targetPage: currentPage,
        })
      );
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
  const {
    galleryVideos,
    initialDesktopBatch,
    initialExamples,
    mainVideo,
    nextOffsetStart,
    pageOffsetEnd,
    showGallerySection,
  } = buildExamplesGalleryPresentation({
    allVideos,
    clientVideos,
    currentPage,
    isModelLanding,
    pageOffsetStart: offset,
    sort,
    videos,
  });
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;
  const buildEngineFilterHref = (engineId: string | null): string =>
    buildExamplesEngineFilterHref({ engineId, galleryBasePath });
  const previousPageHref = buildExamplesPaginationHref({
    engineFromPath,
    galleryBasePath,
    modelLandingSlug: modelLanding?.slug,
    selectedEngine,
    sort,
    targetPage: Math.max(1, currentPage - 1),
  });
  const nextPageHref = buildExamplesPaginationHref({
    engineFromPath,
    galleryBasePath,
    modelLandingSlug: modelLanding?.slug,
    selectedEngine,
    sort,
    targetPage: currentPage + 1,
  });
  const canonicalUrl = modelLanding
    ? `${SITE}${galleryBasePath}/${modelLanding.slug}`
    : `${SITE}${galleryBasePath}`;
  const mainVideoFeature = buildExamplesMainVideoFeatureData({
    locale: appLocale,
    mainVideo,
    modelLandingHeroSubtitle: modelLanding?.heroSubtitle,
    modelLandingLabel: modelLanding?.label ?? selectedOption?.label,
    modelLandingSummary: modelLanding?.summary,
  });
  const { breadcrumbJsonLd, faqJsonLd, itemListJson } = buildExamplesJsonLd({
    canonicalUrl,
    faqBlock,
    galleryBasePath,
    galleryVideos,
    locale: appLocale,
    localePrefix,
    modelLandingLabel: modelLanding?.label ?? null,
  });
  const mainVideoCopy = getExamplesMainVideoCopy(appLocale);

  return (
    <ExamplesPageView
      browseByModelLabel={browseByModelLabel}
      breadcrumbJsonLd={breadcrumbJsonLd}
      currentModelPagesLabel={currentModelPagesLabel}
      currentPage={currentPage}
      displayTotalPages={displayTotalPages}
      engineFilterAllLabel={engineFilterAllLabel}
      engineFilterOptions={engineFilterOptions}
      faqBlock={faqBlock}
      faqJsonLd={faqJsonLd}
      galleryUiCopy={galleryUiCopy}
      getEngineFilterHref={buildEngineFilterHref}
      hasNextPage={hasNextPage}
      hasPreviousPage={hasPreviousPage}
      heroBody={heroBody}
      heroLead={heroLead}
      heroSubtitle={heroSubtitle}
      heroTitle={heroTitle}
      initialDesktopBatch={initialDesktopBatch}
      initialExamples={initialExamples}
      initialMobileBatch={INITIAL_MOBILE_GALLERY_BATCH}
      isModelLanding={isModelLanding}
      itemListJson={itemListJson}
      loadMoreLabel={loadMoreLabel}
      locale={appLocale}
      longDescription={longDescription}
      mainVideo={mainVideo}
      mainVideoCopy={mainVideoCopy}
      mainVideoFeature={mainVideoFeature}
      modelLandingSections={modelLandingSections}
      modelLandingSummary={modelLanding?.summary}
      modelLinks={modelLinks}
      modelPagesLabel={modelPagesLabel}
      nextHref={nextPageHref}
      nextLabel={paginationNextLabel}
      nextOffsetStart={nextOffsetStart}
      nextStepLinks={nextStepLinks}
      pageLabel={paginationPageLabel}
      pageOffsetEnd={pageOffsetEnd}
      previousHref={previousPageHref}
      previousLabel={paginationPrevLabel}
      pricingLinkLabel={pricingLinkLabel}
      pricingPath={pricingPath}
      primaryModelLinks={primaryModelLinks}
      selectedEngine={selectedEngine}
      showGallerySection={showGallerySection}
      sort={sort}
      supportedOlderModelLinks={supportedOlderModelLinks}
      supportedOlderVersionLabel={supportedOlderVersionLabel}
      totalPages={totalPages}
      usesCurrentAndSupportedBlocks={usesCurrentAndSupportedBlocks}
    />
  );
}
