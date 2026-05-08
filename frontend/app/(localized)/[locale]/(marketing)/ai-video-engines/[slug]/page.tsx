import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { localePathnames, locales } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { isDatabaseConfigured } from '@/lib/db';
import { getCompareShowdowns } from '@/config/compare-showdowns';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { getLatestPublicVideoByPromptAndEngine, getPublicVideosByIds, type GalleryVideo } from '@/server/videos';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';
import { CompareDetailContent, type CompareShowdownSlot } from './_components/CompareDetailContent';
import {
  COMPARE_SLUG_MAP,
  ENGINE_OPTIONS,
  PRICING_ENGINES,
  RELATED_COMPARISONS,
  SHOWDOWN_OVERRIDES,
  SHOWDOWNS,
  TROPHY_COMPARISONS,
} from './_lib/compare-page-config';
import type {
  Params,
  ShowdownEntry,
  ShowdownSide,
} from './_lib/compare-page-types';
import { buildCompareDetailLabels, type ComparePageCopy } from './_lib/compare-page-copy';
import { getComparePageOverride } from './_lib/compare-page-overrides';
import { buildCompareFaqItems, buildCompareFaqJsonLd } from './_lib/compare-page-faq';
import { buildComparePageMetadata } from './_lib/compare-page-metadata';
import {
  buildCompareSummaryRows,
  buildComparisonMetrics,
} from './_lib/compare-page-scorecard';
import { buildCompareSpecRows } from './_lib/compare-page-spec-rows';
import {
  buildSpecValues,
  computeOverall,
  computePairScores,
  computePricingScore,
  formatEngineName,
  formatTemplate,
  getCanonicalCompareSlug,
  getEngineAccent,
  getEngineToneVars,
  getPrelaunchCompareNotice,
  hydrateShowdowns,
  isEngineGeneratable,
  isPrelaunchAvailability,
  LOCALIZED_SHOWDOWN_TESTS,
  LOCALIZED_SHOWDOWN_TITLES,
  loadEngineKeySpecs,
  loadEngineScores,
  localizeMappedValue,
  replaceCriteriaCount,
  resolveEngines,
  resolveExcludedCompareRedirect,
  resolvePricingDisplay,
  reverseCompareSlug,
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
  const averageDurations = isDatabaseConfigured() ? await fetchEngineAverageDurations() : [];
  const averageMap = new Map(averageDurations.map((entry) => [entry.engineId, entry.averageDurationMs]));
  const leftAverage = averageMap.get(left.engineId) ?? left.engine?.avgDurationMs ?? null;
  const rightAverage = averageMap.get(right.engineId) ?? right.engine?.avgDurationMs ?? null;
  left = { ...left, engine: { ...left.engine, avgDurationMs: leftAverage } };
  right = { ...right, engine: { ...right.engine, avgDurationMs: rightAverage } };
  const scores = await loadEngineScores();
  const keySpecs = await loadEngineKeySpecs();
  const leftScore = scores.get(left.modelSlug) ?? scores.get(left.engineId) ?? null;
  const rightScore = scores.get(right.modelSlug) ?? scores.get(right.engineId) ?? null;
  const leftKeySpecs =
    keySpecs.get(left.modelSlug)?.keySpecs ?? keySpecs.get(left.engineId)?.keySpecs ?? undefined;
  const rightKeySpecs =
    keySpecs.get(right.modelSlug)?.keySpecs ?? keySpecs.get(right.engineId)?.keySpecs ?? undefined;
  const leftSpecs = buildSpecValues(left, leftKeySpecs);
  const rightSpecs = buildSpecValues(right, rightKeySpecs);
  const pairHasNativeAudio = Boolean(left.engine?.audio) || Boolean(right.engine?.audio);
  const criteriaCount = pairHasNativeAudio ? 11 : 10;
  const pairHasKling3Native4k = left.modelSlug === 'kling-3-4k' || right.modelSlug === 'kling-3-4k';
  const compareShowdowns = pairHasKling3Native4k ? [] : getCompareShowdowns({ pairHasNativeAudio });
  const exposeSourcePrompt = activeLocale === 'en';
  const [leftPricingDisplay, rightPricingDisplay] = await Promise.all([
    resolvePricingDisplay(left, activeLocale, PRICING_ENGINES.get(left.modelSlug)),
    resolvePricingDisplay(right, activeLocale, PRICING_ENGINES.get(right.modelSlug)),
  ]);
  const leftOverall = computeOverall(leftScore);
  const rightOverall = computeOverall(rightScore);
  const hasPrelaunchEngine = isPrelaunchAvailability(left) || isPrelaunchAvailability(right);
  const prelaunchNotice = hasPrelaunchEngine
    ? {
        title: compareCopy.prelaunch?.title ?? getPrelaunchCompareNotice(activeLocale).title,
        body: compareCopy.prelaunch?.notice ?? getPrelaunchCompareNotice(activeLocale).body,
      }
    : null;
  const heroIntroTemplate = replaceCriteriaCount(
    pairHasKling3Native4k
      ? (pageOverride?.heroIntro ??
        `This page compares {left} vs {right} on MaxVideoAI across native 4K delivery, iteration cost, key specs, and a scorecard across ${criteriaCount} criteria. Use it to decide when 4K is worth the premium before opening each engine profile for full specs.`)
      : hasPrelaunchEngine
        ? (compareCopy.hero?.introPrelaunch ??
          `This page compares {left} vs {right} on MaxVideoAI using the same prompts, side-by-side prompts and renders (when available), key specs, and a scorecard across ${criteriaCount} criteria. Use it to shortlist the best fit — then open each engine profile for full specs and prompt examples.`)
        : (pageOverride?.heroIntro ??
          compareCopy.hero?.intro ??
          `This page compares {left} vs {right} on MaxVideoAI using the same prompts, side-by-side renders, key specs, and a scorecard across ${criteriaCount} criteria. Use it to shortlist the best fit — then open each engine profile for full specs and prompt examples.`),
    criteriaCount
  );
  const showdownSubtitle = hasPrelaunchEngine
    ? (compareCopy.showdown?.subtitlePrelaunch ??
      'Side-by-side prompts and renders (when available) on MaxVideoAI. Prompts are identical; outputs may vary by model.')
    : (compareCopy.showdown?.subtitle ??
      'Side-by-side renders from the same prompt on MaxVideoAI. Prompts are identical; outputs may vary by model.');
  const scorecardProvisionalNote = hasPrelaunchEngine
    ? (compareCopy.scorecard?.provisionalNote ??
      'Pre-launch scores are provisional and will update once runtime renders and final pricing are available.')
    : null;
  const prelaunchTryPromptLabel = hasPrelaunchEngine ? labels.tryPromptPrelaunch : labels.tryPrompt;
  const prelaunchOpensGeneratorLabel = hasPrelaunchEngine ? labels.opensGeneratorPrelaunch : labels.opensGenerator;
  const showdownActionLabel = exposeSourcePrompt
    ? prelaunchTryPromptLabel
    : activeLocale === 'fr'
      ? 'Ouvrir le générateur :'
      : activeLocale === 'es'
        ? 'Abrir el generador:'
        : 'Open generator:';
  const showdownActionHint = exposeSourcePrompt
    ? prelaunchOpensGeneratorLabel
    : activeLocale === 'fr'
      ? 'Ouvre le générateur avec ce modèle.'
      : activeLocale === 'es'
        ? 'Abre el generador con este modelo.'
        : 'Opens the generator with this model.';
  const localizedPromptNote = activeLocale === 'fr'
    ? 'Les prompts source restent en anglais pour conserver le meme test entre modèles.'
    : activeLocale === 'es'
      ? 'Los prompts originales se mantienen en ingles para conservar la misma prueba entre motores.'
      : 'Source prompts stay in English to keep the same test across engines.';
  const winnerSummaryHeading = hasPrelaunchEngine
    ? (compareCopy.scorecard?.winnerSummaryPrelaunch ?? 'Current leader (pre-launch)')
    : (compareCopy.scorecard?.winnerSummary ?? 'Winner summary');
  const reversedShowdownSlug = reverseCompareSlug(canonicalSlug);
  const showdownSourceSlug =
    SHOWDOWNS[canonicalSlug] != null ? canonicalSlug : reversedShowdownSlug && SHOWDOWNS[reversedShowdownSlug] != null
      ? reversedShowdownSlug
      : canonicalSlug;
  const showdowns = await hydrateShowdowns(
    SHOWDOWNS[showdownSourceSlug] ?? []
  );
  const normalizePrompt = (value?: string | null) => (value ?? '').trim().toLowerCase();
  const normalizedShowdowns = showdowns.filter(
    (entry): entry is ShowdownEntry => Boolean(entry)
  );
  const showdownsByPrompt = new Map(
    normalizedShowdowns.map((entry) => [normalizePrompt(entry.prompt), entry])
  );
  const showdownsBySlotId = new Map(
    normalizedShowdowns
      .filter((entry) => Boolean(entry.slotId))
      .map((entry) => [entry.slotId as string, entry])
  );
  const orderedShowdowns = compareShowdowns.map((template) => {
    const bySlot = showdownsBySlotId.get(template.id);
    if (bySlot) return bySlot;
    const byPrompt = showdownsByPrompt.get(normalizePrompt(template.prompt));
    if (byPrompt) return byPrompt;
    return null;
  });
  const overrideJobs = new Set<string>();
  compareShowdowns.forEach((template) => {
    const leftOverride = SHOWDOWN_OVERRIDES[left.modelSlug]?.[template.id];
    if (leftOverride) overrideJobs.add(leftOverride);
    const rightOverride = SHOWDOWN_OVERRIDES[right.modelSlug]?.[template.id];
    if (rightOverride) overrideJobs.add(rightOverride);
  });
  const overrideVideos =
    overrideJobs.size && isDatabaseConfigured()
      ? await getPublicVideosByIds(Array.from(overrideJobs))
      : new Map<string, GalleryVideo>();
  const hasMedia = (side?: ShowdownSide | null) => Boolean(side?.videoUrl || side?.posterUrl);
  const fallbackByTemplateId = new Map<string, { left?: GalleryVideo; right?: GalleryVideo }>();
  if (isDatabaseConfigured()) {
    const lookupTasks: Array<Promise<void>> = [];
    compareShowdowns.forEach((template, index) => {
      const entry = orderedShowdowns[index];
      const needsLeft = !hasMedia(entry?.left);
      const needsRight = !hasMedia(entry?.right);
      if (!needsLeft && !needsRight) return;
      if (needsLeft) {
        lookupTasks.push(
          getLatestPublicVideoByPromptAndEngine(template.prompt, left.engineId || left.modelSlug).then((video) => {
            if (!video) return;
            const current = fallbackByTemplateId.get(template.id) ?? {};
            fallbackByTemplateId.set(template.id, { ...current, left: video });
          })
        );
      }
      if (needsRight) {
        lookupTasks.push(
          getLatestPublicVideoByPromptAndEngine(template.prompt, right.engineId || right.modelSlug).then((video) => {
            if (!video) return;
            const current = fallbackByTemplateId.get(template.id) ?? {};
            fallbackByTemplateId.set(template.id, { ...current, right: video });
          })
        );
      }
    });
    if (lookupTasks.length) {
      await Promise.all(lookupTasks);
    }
  }
  const showdownSlots = compareShowdowns.map((template, index) => {
    const entry = orderedShowdowns[index];
    const shouldSwapShowdownSides = showdownSourceSlug === canonicalSlug ? shouldSwapDisplayOrder : !shouldSwapDisplayOrder;
    const entryLeft = shouldSwapShowdownSides ? entry?.right : entry?.left;
    const entryRight = shouldSwapShowdownSides ? entry?.left : entry?.right;
    const fallback = fallbackByTemplateId.get(template.id);
    const fallbackLeft = fallback?.left;
    const fallbackRight = fallback?.right;
    const leftOverrideId = SHOWDOWN_OVERRIDES[left.modelSlug]?.[template.id];
    const rightOverrideId = SHOWDOWN_OVERRIDES[right.modelSlug]?.[template.id];
    const leftOverrideVideo = leftOverrideId ? overrideVideos.get(leftOverrideId) : undefined;
    const rightOverrideVideo = rightOverrideId ? overrideVideos.get(rightOverrideId) : undefined;
    const leftSide = {
      ...(entryLeft ?? {}),
      label: formatEngineName(left),
      videoUrl: entryLeft?.videoUrl ?? leftOverrideVideo?.videoUrl ?? fallbackLeft?.videoUrl,
      posterUrl: entryLeft?.posterUrl ?? leftOverrideVideo?.thumbUrl ?? fallbackLeft?.thumbUrl,
      placeholder: false,
    };
    const rightSide = {
      ...(entryRight ?? {}),
      label: formatEngineName(right),
      videoUrl: entryRight?.videoUrl ?? rightOverrideVideo?.videoUrl ?? fallbackRight?.videoUrl,
      posterUrl: entryRight?.posterUrl ?? rightOverrideVideo?.thumbUrl ?? fallbackRight?.thumbUrl,
      placeholder: false,
    };
    leftSide.placeholder = !hasMedia(leftSide);
    rightSide.placeholder = !hasMedia(rightSide);
    return {
      ...template,
      title: localizeMappedValue(entry?.title ?? template.title, activeLocale, LOCALIZED_SHOWDOWN_TITLES),
      whatItTests: localizeMappedValue(template.whatItTests, activeLocale, LOCALIZED_SHOWDOWN_TESTS),
      prompt: entry?.prompt ?? template.prompt,
      left: leftSide,
      right: rightSide,
    };
  }).filter(Boolean) as CompareShowdownSlot[];
  const leftAccent = getEngineAccent(left);
  const rightAccent = getEngineAccent(right);
  const leftIsPrelaunch = isPrelaunchAvailability(left);
  const rightIsPrelaunch = isPrelaunchAvailability(right);
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

  const relatedSlugs = RELATED_COMPARISONS[canonicalSlug] ?? [];
  const relatedLinks = relatedSlugs
    .map((pairSlug) => {
      const resolvedPair = resolveEngines(pairSlug);
      if (!resolvedPair) return null;
      const canonicalPair = getCanonicalCompareSlug(pairSlug)?.canonicalSlug ?? pairSlug;
      if (!isPublishedComparisonSlug(canonicalPair)) return null;
      return {
        href: { pathname: '/ai-video-engines/[slug]', params: { slug: canonicalPair } },
        label: `${formatEngineName(resolvedPair.left)} vs ${formatEngineName(resolvedPair.right)}`,
      };
    })
    .filter(
      (item): item is { href: { pathname: string; params: { slug: string } }; label: string } => Boolean(item)
    );

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
  });
  const faqJsonLd = buildCompareFaqJsonLd(faqItems);

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: compareCopy.breadcrumb?.root ?? 'Comparisons',
        item: compareHubCanonicalUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: `${formatEngineName(left)} vs ${formatEngineName(right)}`,
        item: comparisonCanonicalUrl,
      },
    ],
  };

  const webPageDescriptionTemplate = replaceCriteriaCount(
    metaOverride?.description ??
      (pairHasKling3Native4k
        ? `Compare {left} vs {right} across native 4K delivery, iteration cost, key specs, and a scorecard across ${criteriaCount} criteria on MaxVideoAI.`
        : compareCopy.meta?.description ??
          `Compare {left} vs {right} with the same prompts, key specs, and a scorecard across ${criteriaCount} criteria on MaxVideoAI.`),
    criteriaCount
  );

  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: formatTemplate(
      metaOverride?.title ?? compareCopy.meta?.title ?? '{left} vs {right}: specs, pricing & prompt test',
      { left: formatEngineName(left), right: formatEngineName(right) }
    ),
    url: comparisonCanonicalUrl,
    description: formatTemplate(webPageDescriptionTemplate, {
      left: formatEngineName(left),
      right: formatEngineName(right),
    }),
  };

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
  const scorecardCriteriaLabel =
    activeLocale === 'fr' ? 'Critères' : activeLocale === 'es' ? 'Criterios' : 'Criteria';
  const generateWithLabel = formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
    engine: '',
  }).trim();

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
