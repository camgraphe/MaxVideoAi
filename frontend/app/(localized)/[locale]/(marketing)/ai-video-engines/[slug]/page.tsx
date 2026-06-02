import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { localePathnames, locales } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { CompareDetailContent } from './_components/CompareDetailContent';
import {
  COMPARE_SLUG_MAP,
  ENGINE_OPTIONS,
  TROPHY_COMPARISONS,
} from './_lib/compare-page-config';
import type { Params } from './_lib/compare-page-types';
import { buildCompareDetailLabels, buildCompareDetailPageText, type ComparePageCopy } from './_lib/compare-page-copy';
import { getComparePageOverride } from './_lib/compare-page-overrides';
import { buildCompareFaqItems, buildCompareFaqJsonLd } from './_lib/compare-page-faq';
import { buildComparePageMetadata } from './_lib/compare-page-metadata';
import { buildRelatedComparisonLinks } from './_lib/compare-page-related-links';
import { buildCompareRouteData } from './_lib/compare-page-route-data';
import { buildCompareBreadcrumbJsonLd, buildCompareWebPageJsonLd } from './_lib/compare-page-schema';
import {
  buildCompareSummaryRows,
  buildComparisonMetrics,
} from './_lib/compare-page-scorecard';
import { buildCompareSpecRows } from './_lib/compare-page-spec-rows';
import { buildCompareShowdownSlots } from './_lib/compare-page-showdowns';
import {
  computePairScores,
  computePricingScore,
  getCanonicalCompareSlug,
  getEngineAccent,
  getEngineToneVars,
  isEngineGeneratable,
  resolveEngines,
  resolveExcludedCompareRedirect,
} from './_lib/compare-page-helpers';

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  const params: Params[] = [];
  locales.forEach((locale) => {
    TROPHY_COMPARISONS.forEach((slug) => {
      const canonical = getCanonicalCompareSlug(slug)?.canonicalSlug ?? slug;
      params.push({ locale, slug: canonical });
    });
  });
  return params;
}

export async function generateMetadata(
  props: {
    params: Promise<Params>;
    searchParams?: Promise<{ order?: string }>;
  }
): Promise<Metadata> {
  return buildComparePageMetadata(props);
}

export default async function CompareDetailPage(
  props: {
    params: Promise<Params>;
    searchParams?: Promise<{ order?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const activeLocale = params.locale ?? 'en';
  const { dictionary } = await resolveDictionary({ locale: activeLocale });
  const compareCopy = (dictionary.comparePage ?? {}) as ComparePageCopy;
  const labels = buildCompareDetailLabels(compareCopy);
  const slug = params.slug;
  const canonicalInfo = getCanonicalCompareSlug(slug);
  if (!canonicalInfo) {
    notFound();
  }
  const requestedOrder = typeof searchParams?.order === 'string' ? searchParams.order : null;
  const excludedRedirect = resolveExcludedCompareRedirect({
    slug: canonicalInfo.canonicalSlug,
    order: requestedOrder,
    locale: activeLocale,
  });
  if (excludedRedirect) {
    redirect(excludedRedirect);
  }
  const resolved = resolveEngines(canonicalInfo.canonicalSlug);
  if (!resolved) {
    notFound();
  }
  const localePrefix = localePathnames[activeLocale] ? `/${localePathnames[activeLocale]}` : '';
  const compareBase = COMPARE_SLUG_MAP[activeLocale] ?? COMPARE_SLUG_MAP.en ?? 'ai-video-engines';
  const compareHubHref = `${localePrefix}/${compareBase}`.replace(/\/{2,}/g, '/');
  const canonicalSlug = canonicalInfo.canonicalSlug;
  const pageOverride = getComparePageOverride(activeLocale, canonicalSlug);
  const compareHubCanonicalUrl = buildMetadataUrls(activeLocale, undefined, { englishPath: '/ai-video-engines' }).canonical;
  const comparisonCanonicalUrl = buildMetadataUrls(activeLocale, undefined, {
    englishPath: `/ai-video-engines/${canonicalSlug}`,
  }).canonical;
  const metaOverride = {
    ...(compareCopy.meta?.slugOverrides?.[canonicalSlug] ?? {}),
    ...(pageOverride?.meta ?? {}),
  };
  if (canonicalSlug !== slug) {
    const orderParam = requestedOrder ?? canonicalInfo.leftSlug;
    const query = orderParam ? `?order=${orderParam}` : '';
    permanentRedirect(`${localePrefix}/${compareBase}/${canonicalSlug}${query}`.replace(/\/{2,}/g, '/'));
  }
  let { left, right } = resolved;
  const shouldSwapDisplayOrder = Boolean(requestedOrder && requestedOrder === right.modelSlug);
  if (shouldSwapDisplayOrder) {
    [left, right] = [right, left];
  }
  const routeData = await buildCompareRouteData({ activeLocale, left, right });
  left = routeData.left;
  right = routeData.right;
  const {
    criteriaCount,
    hasPrelaunchEngine,
    leftIsPrelaunch,
    leftOverall,
    leftPricingDisplay,
    leftScore,
    leftSpecs,
    pairHasKling3Native4k,
    pairHasNativeAudio,
    rightIsPrelaunch,
    rightOverall,
    rightPricingDisplay,
    rightScore,
    rightSpecs,
  } = routeData;
  const showdownSlots = await buildCompareShowdownSlots({
    activeLocale,
    canonicalSlug,
    left,
    pairHasKling3Native4k,
    pairHasNativeAudio,
    right,
    shouldSwapDisplayOrder,
  });
  const {
    exposeSourcePrompt,
    generateWithLabel,
    heroIntroTemplate,
    localizedPromptNote,
    prelaunchNotice,
    scorecardCriteriaLabel,
    scorecardProvisionalNote,
    showdownActionHint,
    showdownActionLabel,
    showdownSubtitle,
    winnerSummaryHeading,
  } = buildCompareDetailPageText({
    activeLocale,
    compareCopy,
    criteriaCount,
    hasPrelaunchEngine,
    labels,
    pageHeroIntro: pageOverride?.heroIntro,
    pairHasKling3Native4k,
    hasShowdownSlots: showdownSlots.length > 0,
  });
  const leftAccent = getEngineAccent(left);
  const rightAccent = getEngineAccent(right);
  const leftCanGenerate = isEngineGeneratable(left);
  const rightCanGenerate = isEngineGeneratable(right);
  const priceScores = {
    leftScore: computePricingScore(leftPricingDisplay.prices),
    rightScore: computePricingScore(rightPricingDisplay.prices),
  };
  const speedScores = computePairScores(left.engine?.avgDurationMs ?? null, right.engine?.avgDurationMs ?? null, true);
  const resolvedLeftOptions = ENGINE_OPTIONS;
  const resolvedRightOptions = ENGINE_OPTIONS;
  const specLabels = compareCopy.specLabels ?? {};
  const specRows = buildCompareSpecRows({
    left,
    right,
    leftSpecs,
    rightSpecs,
    leftPricingDisplay,
    rightPricingDisplay,
    pairHasNativeAudio,
    specLabels,
  });

  const relatedLinks = buildRelatedComparisonLinks(canonicalSlug);

  const faqItems = buildCompareFaqItems({
    activeLocale,
    compareCopy,
    labels,
    left,
    right,
    leftPricingDisplay,
    rightPricingDisplay,
    leftSpecs,
    rightSpecs,
    pageOverride,
    pairHasKling3Native4k,
    pairHasNativeAudio,
    specLabels,
    hasShowdownSlots: showdownSlots.length > 0,
  });
  const faqJsonLd = buildCompareFaqJsonLd(faqItems);

  const breadcrumbJsonLd = buildCompareBreadcrumbJsonLd({
    compareCopy,
    compareHubCanonicalUrl,
    comparisonCanonicalUrl,
    left,
    right,
  });

  const webPageJsonLd = buildCompareWebPageJsonLd({
    compareCopy,
    comparisonCanonicalUrl,
    criteriaCount,
    left,
    metaOverride,
    pairHasKling3Native4k,
    right,
  });

  const comparisonMetrics = buildComparisonMetrics({
    compareCopy,
    leftScore,
    rightScore,
    pairHasNativeAudio,
    priceScores,
    speedScores,
  });
  const summaryRows = buildCompareSummaryRows({
    activeLocale,
    compareCopy,
    comparisonMetrics,
    hasPrelaunchEngine,
    labels,
    left,
    right,
    leftPricingDisplay,
    rightPricingDisplay,
    leftSpecs,
    rightSpecs,
    priceScores,
    specLabels,
  });
  const leftScoreStyle = getEngineToneVars(left, leftOverall);
  const rightScoreStyle = getEngineToneVars(right, rightOverall);

  return (
    <CompareDetailContent
      activeLocale={activeLocale}
      breadcrumbJsonLd={breadcrumbJsonLd}
      compareCopy={compareCopy}
      compareHubHref={compareHubHref}
      comparisonMetrics={comparisonMetrics}
      criteriaCount={criteriaCount}
      exposeSourcePrompt={exposeSourcePrompt}
      faqItems={faqItems}
      faqJsonLd={faqJsonLd}
      generateWithLabel={generateWithLabel}
      heroIntroTemplate={heroIntroTemplate}
      labels={labels}
      left={left}
      leftAccent={leftAccent}
      leftCanGenerate={leftCanGenerate}
      leftIsPrelaunch={leftIsPrelaunch}
      leftOverall={leftOverall}
      leftScoreStyle={leftScoreStyle}
      localizedPromptNote={localizedPromptNote}
      pageOverride={pageOverride}
      pairHasNativeAudio={pairHasNativeAudio}
      prelaunchNotice={prelaunchNotice}
      relatedLinks={relatedLinks}
      resolvedLeftOptions={resolvedLeftOptions}
      resolvedRightOptions={resolvedRightOptions}
      right={right}
      rightAccent={rightAccent}
      rightCanGenerate={rightCanGenerate}
      rightIsPrelaunch={rightIsPrelaunch}
      rightOverall={rightOverall}
      rightScoreStyle={rightScoreStyle}
      scorecardCriteriaLabel={scorecardCriteriaLabel}
      scorecardProvisionalNote={scorecardProvisionalNote}
      showdownActionHint={showdownActionHint}
      showdownActionLabel={showdownActionLabel}
      showdownSlots={showdownSlots}
      showdownSubtitle={showdownSubtitle}
      slug={slug}
      specRows={specRows}
      summaryRows={summaryRows}
      webPageJsonLd={webPageJsonLd}
      winnerSummaryHeading={winnerSummaryHeading}
    />
  );
}
