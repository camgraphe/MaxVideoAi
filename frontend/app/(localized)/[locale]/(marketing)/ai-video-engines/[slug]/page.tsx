import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, Trophy } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { localePathnames, locales } from '@/i18n/locales';
import { resolveDictionary } from '@/lib/i18n/server';
import { buildSeoMetadata } from '@/lib/seo/metadata';
import { buildMetadataUrls } from '@/lib/metadataUrls';
import { isDatabaseConfigured } from '@/lib/db';
import { getCompareShowdowns, type CompareShowdown } from '@/config/compare-showdowns';
import { isPublishedComparisonSlug } from '@/lib/compare-hub/data';
import { ButtonLink } from '@/components/ui/Button';
import { DeferredSourcePrompt } from '@/components/i18n/DeferredSourcePrompt.client';
import { EngineIcon } from '@/components/ui/EngineIcon';
import { CompareEngineSelector } from './CompareEngineSelector.client';
import { CompareScoreboard } from './CompareScoreboard.client';
import { CopyPromptButton } from './CopyPromptButton.client';
import { renderShowdownMedia } from './_components/CompareShowdownMedia';
import { renderSpecValue } from './_components/CompareSpecValue';
import { getLatestPublicVideoByPromptAndEngine, getPublicVideosByIds, type GalleryVideo } from '@/server/videos';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';
import { getImageAlt } from '@/lib/image-alt';
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
  EngineCatalogEntry,
  Params,
  ShowdownEntry,
  ShowdownSide,
} from './_lib/compare-page-types';
import type { ComparePageCopy } from './_lib/compare-page-copy';
import { getComparePageOverride } from './_lib/compare-page-overrides';
import {
  buildGenerateHref,
  buildSpecValues,
  computeOverall,
  computePairScores,
  computePricingScore,
  formatEngineMetaName,
  formatEngineName,
  formatEngineShortName,
  formatSpeedChip,
  formatTemplate,
  getCanonicalCompareSlug,
  getEngineAccent,
  getEngineToneVars,
  getPrelaunchCompareNotice,
  hydrateShowdowns,
  isEngineGeneratable,
  isPending,
  isPrelaunchAvailability,
  LOCALIZED_SHOWDOWN_TESTS,
  LOCALIZED_SHOWDOWN_TITLES,
  loadEngineKeySpecs,
  loadEngineScores,
  localizeBestFor,
  localizeMappedValue,
  localizeSpecDetailValue,
  parseFirstNumber,
  parseResolutionValue,
  pickFirstCapabilityDifference,
  pickOutputDifference,
  replaceCriteriaCount,
  resolveEngines,
  resolveExcludedCompareRedirect,
  resolvePricingDisplay,
  reverseCompareSlug,
  stripAudioReferencesForSilentPair,
  type OverallTone,
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
  const searchParams = await props.searchParams;
  const params = await props.params;
  const locale = params.locale ?? 'en';
  const { dictionary } = await resolveDictionary({ locale });
  const compareCopy = (dictionary.comparePage ?? {}) as ComparePageCopy;
  const slug = params.slug;
  const canonicalInfo = getCanonicalCompareSlug(slug);
  const canonicalSlug = canonicalInfo?.canonicalSlug ?? slug;
  const pageOverride = getComparePageOverride(locale, canonicalSlug);
  const metaOverride = {
    ...(compareCopy.meta?.slugOverrides?.[canonicalSlug] ?? {}),
    ...(pageOverride?.meta ?? {}),
  };
  const resolved = canonicalInfo ? resolveEngines(canonicalInfo.canonicalSlug) : null;
  const pairHasNativeAudio = Boolean(resolved?.left.engine?.audio) || Boolean(resolved?.right.engine?.audio);
  const criteriaCount = pairHasNativeAudio ? 11 : 10;
  const titleTemplate =
    metaOverride.title ?? compareCopy.meta?.title ?? '{left} vs {right} — Side-by-Side Specs, Pricing & Prompt Test | MaxVideoAI';
  const titleFallback =
    compareCopy.meta?.titleFallback ??
    'Compare AI video engines — Side-by-Side Specs, Pricing & Prompt Test | MaxVideoAI';
  const descriptionTemplate = replaceCriteriaCount(
    metaOverride.description ??
      compareCopy.meta?.description ??
      `Compare {left} vs {right} on MaxVideoAI with identical prompts, key specs, and a scorecard across ${criteriaCount} criteria.`,
    criteriaCount
  );
  const descriptionFallback =
    compareCopy.meta?.descriptionFallback ?? 'Side-by-side comparison of AI video engines with MaxVideoAI metrics and guidance.';
  const title = resolved
    ? formatTemplate(titleTemplate, {
        left: formatEngineMetaName(resolved.left),
        right: formatEngineMetaName(resolved.right),
      })
    : titleFallback;
  const description = resolved
    ? formatTemplate(descriptionTemplate, {
        left: formatEngineName(resolved.left),
        right: formatEngineName(resolved.right),
      })
    : descriptionFallback;

  let robots: Metadata['robots'] | undefined;
  if (!isPublishedComparisonSlug(canonicalSlug)) {
    robots = { index: false, follow: true };
  }
  if (resolved) {
    const keySpecs = await loadEngineKeySpecs();
    const leftKeySpecs = keySpecs.get(resolved.left.modelSlug)?.keySpecs ?? undefined;
    const rightKeySpecs = keySpecs.get(resolved.right.modelSlug)?.keySpecs ?? undefined;
    const leftSpecs = buildSpecValues(resolved.left, leftKeySpecs);
    const rightSpecs = buildSpecValues(resolved.right, rightKeySpecs);
    const rows = [
      leftSpecs.textToVideo,
      rightSpecs.textToVideo,
      leftSpecs.imageToVideo,
      rightSpecs.imageToVideo,
      leftSpecs.videoToVideo,
      rightSpecs.videoToVideo,
      leftSpecs.firstLastFrame,
      rightSpecs.firstLastFrame,
      leftSpecs.referenceImageStyle,
      rightSpecs.referenceImageStyle,
      leftSpecs.referenceVideo,
      rightSpecs.referenceVideo,
      leftSpecs.maxResolution,
      rightSpecs.maxResolution,
      leftSpecs.maxDuration,
      rightSpecs.maxDuration,
      leftSpecs.aspectRatios,
      rightSpecs.aspectRatios,
      leftSpecs.fpsOptions,
      rightSpecs.fpsOptions,
      leftSpecs.outputFormats,
      rightSpecs.outputFormats,
    ];
    const pendingCount = rows.filter((value) => isPending(value)).length;
    const pendingRatio = rows.length ? pendingCount / rows.length : 0;
    if (pendingRatio >= 0.35) {
      robots = { index: false, follow: true };
    }
  }
  if (typeof searchParams?.order === 'string' && searchParams.order.trim()) {
    robots = { index: false, follow: true };
  }

  const meta = buildSeoMetadata({
    locale,
    title,
    description,
    englishPath: `/ai-video-engines/${canonicalSlug}`,
    robots,
  });
  return meta;
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
  const labels = {
    pending: compareCopy.labels?.pending ?? 'Data pending',
    supported: compareCopy.labels?.supported ?? 'Supported',
    notSupported: compareCopy.labels?.notSupported ?? 'Not supported',
    na: compareCopy.labels?.na ?? 'N/A',
    prompt: compareCopy.labels?.prompt ?? 'Prompt',
    tryPrompt: compareCopy.labels?.tryPrompt ?? 'Try this prompt:',
    tryPromptPrelaunch: compareCopy.labels?.tryPromptPrelaunch ?? 'Prompt actions:',
    opensGenerator: compareCopy.labels?.opensGenerator ?? 'Opens the generator pre-filled.',
    opensGeneratorPrelaunch:
      compareCopy.labels?.opensGeneratorPrelaunch ??
      'Use these prompt links for planning; pre-launch engines unlock at launch.',
    savePromptForLaunch: compareCopy.labels?.savePromptForLaunch ?? 'Save this prompt for launch',
    whatTests: compareCopy.labels?.whatTests ?? 'What it tests',
    placeholder: compareCopy.labels?.placeholder ?? '',
    expandPrompt: compareCopy.labels?.expandPrompt ?? 'Show full prompt',
    collapsePrompt: compareCopy.labels?.collapsePrompt ?? 'Hide full prompt',
  };
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
  type ShowdownSlot = CompareShowdown & { left: ShowdownSide; right: ShowdownSide };
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
  }).filter(Boolean) as ShowdownSlot[];
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
  const specRows = [
    {
      label: specLabels.pricing ?? 'Pricing (MaxVideoAI)',
      left: leftPricingDisplay.headline,
      right: rightPricingDisplay.headline,
      subline: leftPricingDisplay.subline,
      rightSubline: rightPricingDisplay.subline,
    },
    { label: specLabels.textToVideo ?? 'Text-to-Video', left: leftSpecs.textToVideo, right: rightSpecs.textToVideo },
    { label: specLabels.imageToVideo ?? 'Image-to-Video', left: leftSpecs.imageToVideo, right: rightSpecs.imageToVideo },
    { label: specLabels.videoToVideo ?? 'Video-to-Video', left: leftSpecs.videoToVideo, right: rightSpecs.videoToVideo },
    { label: specLabels.firstLastFrame ?? 'First/Last frame', left: leftSpecs.firstLastFrame, right: rightSpecs.firstLastFrame },
    {
      label: specLabels.referenceImageStyle ?? 'Reference image / style reference',
      left: leftSpecs.referenceImageStyle,
      right: rightSpecs.referenceImageStyle,
    },
    { label: specLabels.referenceVideo ?? 'Reference video', left: leftSpecs.referenceVideo, right: rightSpecs.referenceVideo },
    { label: specLabels.maxResolution ?? 'Max resolution', left: leftSpecs.maxResolution, right: rightSpecs.maxResolution },
    { label: specLabels.maxDuration ?? 'Max duration', left: leftSpecs.maxDuration, right: rightSpecs.maxDuration },
    {
      label: specLabels.avgRenderTime ?? 'Avg render time',
      left: formatSpeedChip(left),
      right: formatSpeedChip(right),
    },
    { label: specLabels.aspectRatios ?? 'Aspect ratios', left: leftSpecs.aspectRatios, right: rightSpecs.aspectRatios },
    { label: specLabels.fpsOptions ?? 'FPS options', left: leftSpecs.fpsOptions, right: rightSpecs.fpsOptions },
    { label: specLabels.outputFormats ?? 'Output format', left: leftSpecs.outputFormats, right: rightSpecs.outputFormats },
    ...(pairHasNativeAudio
      ? [
          { label: specLabels.audioOutput ?? 'Audio output', left: leftSpecs.audioOutput, right: rightSpecs.audioOutput },
          {
            label: specLabels.nativeAudioGeneration ?? 'Native audio generation',
            left: leftSpecs.nativeAudioGeneration,
            right: rightSpecs.nativeAudioGeneration,
          },
          { label: specLabels.lipSync ?? 'Lip sync', left: leftSpecs.lipSync, right: rightSpecs.lipSync },
        ]
      : []),
    {
      label: specLabels.cameraMotionControls ?? 'Camera / motion controls',
      left: leftSpecs.cameraMotionControls,
      right: rightSpecs.cameraMotionControls,
    },
    { label: specLabels.watermark ?? 'Watermark', left: leftSpecs.watermark, right: rightSpecs.watermark },
  ].filter((row) => !(isPending(row.left) && isPending(row.right)));

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

  const validatingLabel = compareCopy.faq?.validating ?? 'still being validated';
  const formatFaqValue = (value: string) =>
    isPending(value) ? validatingLabel : localizeSpecDetailValue(value, activeLocale, labels);
  const faqPricingLeft = formatFaqValue(leftPricingDisplay.headline);
  const faqPricingRight = formatFaqValue(rightPricingDisplay.headline);
  const faqT2vLeft = formatFaqValue(leftSpecs.textToVideo);
  const faqT2vRight = formatFaqValue(rightSpecs.textToVideo);
  const faqI2vLeft = formatFaqValue(leftSpecs.imageToVideo);
  const faqI2vRight = formatFaqValue(rightSpecs.imageToVideo);
  const faqV2vLeft = formatFaqValue(leftSpecs.videoToVideo);
  const faqV2vRight = formatFaqValue(rightSpecs.videoToVideo);
  const faqFirstLastLeft = formatFaqValue(leftSpecs.firstLastFrame);
  const faqFirstLastRight = formatFaqValue(rightSpecs.firstLastFrame);
  const faqRefImgLeft = formatFaqValue(leftSpecs.referenceImageStyle);
  const faqRefImgRight = formatFaqValue(rightSpecs.referenceImageStyle);
  const faqRefVidLeft = formatFaqValue(leftSpecs.referenceVideo);
  const faqRefVidRight = formatFaqValue(rightSpecs.referenceVideo);
  const faqResLeft = formatFaqValue(leftSpecs.maxResolution);
  const faqResRight = formatFaqValue(rightSpecs.maxResolution);
  const faqDurLeft = formatFaqValue(leftSpecs.maxDuration);
  const faqDurRight = formatFaqValue(rightSpecs.maxDuration);
  const faqArLeft = formatFaqValue(leftSpecs.aspectRatios);
  const faqArRight = formatFaqValue(rightSpecs.aspectRatios);
  const faqAudioOutLeft = formatFaqValue(leftSpecs.audioOutput);
  const faqAudioOutRight = formatFaqValue(rightSpecs.audioOutput);
  const faqAudioGenLeft = formatFaqValue(leftSpecs.nativeAudioGeneration);
  const faqAudioGenRight = formatFaqValue(rightSpecs.nativeAudioGeneration);
  const faqLipLeft = formatFaqValue(leftSpecs.lipSync);
  const faqLipRight = formatFaqValue(rightSpecs.lipSync);
  const capabilityTemplates = {
    value:
      compareCopy.faq?.capabilityDiff ??
      '{label}: {left} is {leftValue} vs {right} is {rightValue}.',
    pending:
      compareCopy.faq?.capabilityPending ??
      '{label}: both are {status}.',
  };
  const outputTemplates = {
    value:
      compareCopy.faq?.outputDiff ??
      '{label}: {left} is {leftValue} vs {right} is {rightValue}.',
    pending:
      compareCopy.faq?.outputPending ??
      '{label}: data is still being validated for one or both engines.',
  };
  const faqCapabilityDiff = pickFirstCapabilityDifference(
    left,
    right,
    [
      { label: specLabels.lipSync ?? 'Lip sync', leftStatus: faqLipLeft, rightStatus: faqLipRight },
      {
        label: specLabels.nativeAudioGeneration ?? 'Native audio generation',
        leftStatus: faqAudioGenLeft,
        rightStatus: faqAudioGenRight,
      },
      { label: specLabels.firstLastFrame ?? 'First/Last frame', leftStatus: faqFirstLastLeft, rightStatus: faqFirstLastRight },
      {
        label: specLabels.referenceImageStyle ?? 'Reference image / style reference',
        leftStatus: faqRefImgLeft,
        rightStatus: faqRefImgRight,
      },
      { label: specLabels.referenceVideo ?? 'Reference video', leftStatus: faqRefVidLeft, rightStatus: faqRefVidRight },
      { label: specLabels.videoToVideo ?? 'Video-to-Video', leftStatus: faqV2vLeft, rightStatus: faqV2vRight },
      { label: specLabels.imageToVideo ?? 'Image-to-Video', leftStatus: faqI2vLeft, rightStatus: faqI2vRight },
      { label: specLabels.textToVideo ?? 'Text-to-Video', leftStatus: faqT2vLeft, rightStatus: faqT2vRight },
    ],
    capabilityTemplates,
    validatingLabel,
    activeLocale
  );
  const faqOutputDiff = pickOutputDifference(
    formatEngineName(left),
    formatEngineName(right),
    faqResLeft,
    faqResRight,
    compareCopy.faq?.outputLabel ?? 'Max resolution',
    outputTemplates,
    validatingLabel
  );
  const faqTemplates = compareCopy.faq ?? {};
  const kling3Native4kFaqCopy = pairHasKling3Native4k
    ? activeLocale === 'fr'
      ? {
          a1: '{left} et {right} sont des modèles de génération vidéo IA disponibles sur MaxVideoAI. Cette page compare la livraison 4K native, le coût d’itération, les caractéristiques clés et les données ci-dessus.',
          a2: 'Cela dépend du flux de production. Utilisez la grille de scores et les caractéristiques pour décider si le plan a besoin d’une livraison 4K native ou d’une route d’itération moins coûteuse, puis ouvrez chaque profil pour les détails complets.',
          q10: 'Pourquoi les résultats peuvent-ils différer entre ces routes ?',
          a10: 'Même avec des instructions proches, les modèles interprètent différemment les contraintes et les réglages. Pour Kling 3 4K, comparez d’abord les caractéristiques et l’échelle de coût, puis rendez seulement les plans finalisés en 4K native.',
        }
      : activeLocale === 'es'
        ? {
            a1: '{left} y {right} son motores de generación de video IA disponibles en MaxVideoAI. Esta página compara entrega 4K nativa, costo de iteración, specs clave y los datos anteriores.',
            a2: 'Depende de tu flujo de trabajo. Usa el scorecard y las specs para decidir si el plano necesita entrega 4K nativa o una ruta de iteración de menor costo, luego abre cada perfil para los detalles completos.',
            q10: '¿Por qué pueden diferir los resultados entre estas rutas?',
            a10: 'Incluso con instrucciones similares, los modelos interpretan las restricciones y los ajustes de forma distinta. Para Kling 3 4K, compara primero las specs y la escala de costo, luego renderiza en 4K nativo solo los planos aprobados.',
          }
        : {
            a1: '{left} and {right} are AI video generation engines available on MaxVideoAI. This page compares native 4K delivery, iteration cost, key specs, and performance data shown above.',
            a2: 'It depends on your workflow. Use the scorecard and specs to decide whether the job needs native 4K delivery or a lower-cost iteration route, then open each engine profile for full details.',
            q10: 'Why can results differ between these routes?',
            a10: 'Even with similar instructions, models interpret constraints and settings differently. For Kling 3 4K, compare the specs and cost ladder first, then render only approved final shots in native 4K.',
          }
    : null;

  const generatedFaqItems = [
    {
      question: formatTemplate(
        faqTemplates.q1 ?? 'What are {left} and {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer: formatTemplate(
        kling3Native4kFaqCopy?.a1 ??
          faqTemplates.a1 ??
          '{left} and {right} are AI video generation engines available on MaxVideoAI. This page compares them side-by-side using the same prompts, key specs, and performance data shown above.',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
    },
    {
      question: formatTemplate(
        faqTemplates.q2 ?? 'Which is better: {left} or {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer:
        kling3Native4kFaqCopy?.a2 ??
        faqTemplates.a2 ??
        'It depends on your workflow. Use the scorecard and the “same prompt” showdowns to compare prompt adherence, motion realism, human fidelity, and text legibility — then open each engine profile for full details.',
    },
    {
      question: faqTemplates.q3 ?? 'Which is cheaper on MaxVideoAI?',
      answer: formatTemplate(
        stripAudioReferencesForSilentPair(
          faqTemplates.a3 ??
          (pairHasNativeAudio
            ? 'Pricing varies by engine and settings (duration, resolution, audio). Currently, {left} starts at {leftValue} and {right} starts at {rightValue} (see “Pricing (MaxVideoAI)” for details).'
            : 'Pricing varies by engine and settings (duration and resolution). Currently, {left} starts at {leftValue} and {right} starts at {rightValue} (see “Pricing (MaxVideoAI)” for details).'),
          pairHasNativeAudio
        ),
        {
          left: formatEngineName(left),
          right: formatEngineName(right),
          leftValue: faqPricingLeft,
          rightValue: faqPricingRight,
        }
      ),
    },
    {
      question: formatTemplate(
        faqTemplates.q4 ?? 'What are the biggest differences between {left} and {right}?',
        { left: formatEngineName(left), right: formatEngineName(right) }
      ),
      answer: [faqCapabilityDiff, faqOutputDiff],
    },
    {
      question:
        faqTemplates.q5 ?? 'Do they support Text-to-Video / Image-to-Video / Video-to-Video?',
      answer: formatTemplate(
        faqTemplates.a5 ??
          'On MaxVideoAI: Text-to-Video is {t2vLeft} vs {t2vRight}; Image-to-Video is {i2vLeft} vs {i2vRight}; Video-to-Video is {v2vLeft} vs {v2vRight}. Some fields may still be under validation.',
        {
          t2vLeft: faqT2vLeft,
          t2vRight: faqT2vRight,
          i2vLeft: faqI2vLeft,
          i2vRight: faqI2vRight,
          v2vLeft: faqV2vLeft,
          v2vRight: faqV2vRight,
        }
      ),
    },
    {
      question: faqTemplates.q6 ?? 'Do they support First/Last frame or references?',
      answer: formatTemplate(
        faqTemplates.a6 ??
          'First/Last frame is {firstLeft} vs {firstRight}. Reference image/style is {refImgLeft} vs {refImgRight}; Reference video is {refVidLeft} vs {refVidRight}.',
        {
          firstLeft: faqFirstLastLeft,
          firstRight: faqFirstLastRight,
          refImgLeft: faqRefImgLeft,
          refImgRight: faqRefImgRight,
          refVidLeft: faqRefVidLeft,
          refVidRight: faqRefVidRight,
        }
      ),
    },
    {
      question: faqTemplates.q7 ?? 'What are the max resolution, duration, and aspect ratios?',
      answer: formatTemplate(
        faqTemplates.a7 ??
          'Max output is {resLeft} / {durLeft} for {left} and {resRight} / {durRight} for {right}. Supported aspect ratios include {arLeft} vs {arRight} (see Key Specs for the full list).',
        {
          resLeft: faqResLeft,
          durLeft: faqDurLeft,
          left: formatEngineName(left),
          resRight: faqResRight,
          durRight: faqDurRight,
          right: formatEngineName(right),
          arLeft: faqArLeft,
          arRight: faqArRight,
        }
      ),
    },
    ...(pairHasNativeAudio
      ? [
          {
            question: faqTemplates.q8 ?? 'Do they support audio generation and lip sync?',
            answer: formatTemplate(
              faqTemplates.a8 ??
                'Audio output is {audioOutLeft} vs {audioOutRight}. Native audio generation is {audioGenLeft} vs {audioGenRight}, and lip sync is {lipLeft} vs {lipRight} (some fields may still be under validation).',
              {
                audioOutLeft: faqAudioOutLeft,
                audioOutRight: faqAudioOutRight,
                audioGenLeft: faqAudioGenLeft,
                audioGenRight: faqAudioGenRight,
                lipLeft: faqLipLeft,
                lipRight: faqLipRight,
              }
            ),
          },
        ]
      : []),
    {
      question: faqTemplates.q9 ?? 'Does MaxVideoAI add a watermark?',
      answer:
        faqTemplates.a9 ??
        'No. MaxVideoAI exports are watermark-free (“Watermark: No (MaxVideoAI)”).',
    },
    {
      question:
        kling3Native4kFaqCopy?.q10 ??
        faqTemplates.q10 ??
        'Why do results look different with the same prompt?',
      answer:
        kling3Native4kFaqCopy?.a10 ??
        faqTemplates.a10 ??
        'Even with identical prompts, models interpret instructions differently and use different training data and generation strategies. That’s why the Showdown section exists: same prompt, side-by-side outputs.',
    },
    {
      question: faqTemplates.q11 ?? 'Where can I find full specs, controls, and more prompt examples?',
      answer: formatTemplate(
        faqTemplates.a11 ??
          'Open the full engine profiles for complete specs, controls, and more prompts: /models/{leftSlug} and /models/{rightSlug}. You can also browse more outputs in the engine galleries.',
        { leftSlug: left.modelSlug, rightSlug: right.modelSlug }
      ),
    },
  ];
  const faqItems = pageOverride?.faq?.items ?? generatedFaqItems;

  const faqJsonLdItems = faqItems.filter((item) => {
    const text = Array.isArray(item.answer) ? item.answer.join(' ') : item.answer;
    return !text.toLowerCase().includes('data pending');
  });

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqJsonLdItems.slice(0, 6).map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: Array.isArray(item.answer) ? item.answer.join(' ') : item.answer,
      },
    })),
  };

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

  const comparisonMetrics = [
    {
      id: 'prompt_adherence',
      label: compareCopy.metrics?.prompt_adherence?.label ?? 'Prompt Adherence',
      tooltip: compareCopy.metrics?.prompt_adherence?.tooltip ?? 'prompt alignment / instruction following',
      leftValue: leftScore?.fidelity ?? null,
      rightValue: rightScore?.fidelity ?? null,
    },
    {
      id: 'visual_quality',
      label: compareCopy.metrics?.visual_quality?.label ?? 'Visual Quality',
      tooltip:
        compareCopy.metrics?.visual_quality?.tooltip ??
        'image quality / aesthetic quality / realism / artifacts / flicker',
      leftValue: leftScore?.visualQuality ?? null,
      rightValue: rightScore?.visualQuality ?? null,
    },
    {
      id: 'motion_realism',
      label: compareCopy.metrics?.motion_realism?.label ?? 'Motion Realism',
      tooltip: compareCopy.metrics?.motion_realism?.tooltip ?? 'motion smoothness / physics plausibility',
      leftValue: leftScore?.motion ?? null,
      rightValue: rightScore?.motion ?? null,
    },
    {
      id: 'temporal_consistency',
      label: compareCopy.metrics?.temporal_consistency?.label ?? 'Temporal Consistency',
      tooltip:
        compareCopy.metrics?.temporal_consistency?.tooltip ?? 'temporal coherence / identity consistency',
      leftValue: leftScore?.consistency ?? null,
      rightValue: rightScore?.consistency ?? null,
    },
    {
      id: 'human_fidelity',
      label: compareCopy.metrics?.human_fidelity?.label ?? 'Human Fidelity',
      tooltip: compareCopy.metrics?.human_fidelity?.tooltip ?? 'faces / hands / body realism',
      leftValue: leftScore?.anatomy ?? null,
      rightValue: rightScore?.anatomy ?? null,
    },
    {
      id: 'text_ui_legibility',
      label: compareCopy.metrics?.text_ui_legibility?.label ?? 'Text & UI Legibility',
      tooltip: compareCopy.metrics?.text_ui_legibility?.tooltip ?? 'text rendering / readability',
      leftValue: leftScore?.textRendering ?? null,
      rightValue: rightScore?.textRendering ?? null,
    },
    ...(pairHasNativeAudio
      ? [
          {
            id: 'audio_lip_sync',
            label: compareCopy.metrics?.audio_lip_sync?.label ?? 'Audio & Lip Sync',
            tooltip: compareCopy.metrics?.audio_lip_sync?.tooltip ?? 'lip sync quality / dialogue sync',
            leftValue: leftScore?.lipsyncQuality ?? null,
            rightValue: rightScore?.lipsyncQuality ?? null,
          },
        ]
      : []),
    {
      id: 'multi_shot_sequencing',
      label: compareCopy.metrics?.multi_shot_sequencing?.label ?? 'Multi-Shot Sequencing',
      tooltip:
        compareCopy.metrics?.multi_shot_sequencing?.tooltip ?? 'shot-to-shot continuity / multi-shot',
      leftValue: leftScore?.sequencingQuality ?? null,
      rightValue: rightScore?.sequencingQuality ?? null,
    },
    {
      id: 'controllability',
      label: compareCopy.metrics?.controllability?.label ?? 'Controllability',
      tooltip: compareCopy.metrics?.controllability?.tooltip ?? 'camera control / constraint following',
      leftValue: leftScore?.controllability ?? null,
      rightValue: rightScore?.controllability ?? null,
    },
    {
      id: 'speed_stability',
      label: compareCopy.metrics?.speed_stability?.label ?? 'Speed & Stability',
      tooltip: compareCopy.metrics?.speed_stability?.tooltip ?? 'latency / success rate',
      leftValue: leftScore?.speedStability ?? speedScores.leftScore,
      rightValue: rightScore?.speedStability ?? speedScores.rightScore,
    },
    {
      id: 'pricing',
      label: compareCopy.metrics?.pricing?.label ?? 'Pricing',
      tooltip:
        compareCopy.metrics?.pricing?.tooltip ?? 'price per second / credits / estimated cost',
      leftValue: priceScores.leftScore,
      rightValue: priceScores.rightScore,
    },
  ];

  const scoredMetrics = comparisonMetrics
    .filter((metric) => typeof metric.leftValue === 'number' && typeof metric.rightValue === 'number')
    .map((metric) => {
      const leftValue = metric.leftValue as number;
      const rightValue = metric.rightValue as number;
      const winner = leftValue === rightValue ? 'tie' : leftValue > rightValue ? 'left' : 'right';
      return {
        label: metric.label,
        leftValue,
        rightValue,
        winner,
        delta: Math.abs(leftValue - rightValue),
      };
    });
  const leftWins = scoredMetrics.filter((metric) => metric.winner === 'left').length;
  const rightWins = scoredMetrics.filter((metric) => metric.winner === 'right').length;
  const totalScored = scoredMetrics.length;
  const scoreLeader = leftWins === rightWins ? null : leftWins > rightWins ? 'left' : 'right';
  const topWinner = scoreLeader === 'left' ? left : scoreLeader === 'right' ? right : null;
  const topDeltas = scoredMetrics
    .filter((metric) => metric.winner === scoreLeader)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2)
    .map((metric) => metric.label);

  const pricingWinner =
    typeof priceScores.leftScore === 'number' && typeof priceScores.rightScore === 'number'
      ? priceScores.leftScore === priceScores.rightScore
        ? null
        : priceScores.leftScore > priceScores.rightScore
          ? 'left'
          : 'right'
      : null;

  const deriveStrengths = (side: 'left' | 'right') =>
    comparisonMetrics
      .filter((metric) => typeof metric.leftValue === 'number' && typeof metric.rightValue === 'number')
      .map((metric) => {
        const leftValue = metric.leftValue as number;
        const rightValue = metric.rightValue as number;
        if (side === 'left' && leftValue > rightValue) {
          return { label: metric.label, delta: Math.abs(leftValue - rightValue) };
        }
        if (side === 'right' && rightValue > leftValue) {
          return { label: metric.label, delta: Math.abs(leftValue - rightValue) };
        }
        return null;
      })
      .filter((entry): entry is { label: string; delta: number } => Boolean(entry))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 2)
      .map((entry) => entry.label);

  const durationLeft = parseFirstNumber(leftSpecs.maxDuration);
  const durationRight = parseFirstNumber(rightSpecs.maxDuration);
  const durationWinner =
    typeof durationLeft === 'number' && typeof durationRight === 'number'
      ? durationLeft === durationRight
        ? null
        : durationLeft > durationRight
          ? 'left'
          : 'right'
      : null;
  const durationSummary = `${formatFaqValue(leftSpecs.maxDuration)} vs ${formatFaqValue(rightSpecs.maxDuration)}`;
  const pricingSummary = `${leftPricingDisplay.headline} vs ${rightPricingDisplay.headline}`;
  const summaryCopy = compareCopy.summary ?? {};
  const scorecardTemplate = hasPrelaunchEngine
    ? (summaryCopy.scorecardTemplatePrelaunch ??
      'Currently leads on scorecard (provisional): {engine} leads on {wins}/{total}{best}.')
    : (summaryCopy.scorecardTemplate ??
      'Scorecard winner: {engine} leads on {wins}/{total}{best}.');
  const scorecardSummaryLabel = hasPrelaunchEngine
    ? (summaryCopy.scorecardLabelPrelaunch ?? 'Currently leads on scorecard (provisional)')
    : (summaryCopy.scorecardLabel ?? 'Scorecard winner');
  const pricingTemplate =
    summaryCopy.pricingTemplate ??
    'Cheaper: {engine} ({pricing}).';
  const durationTemplate =
    summaryCopy.durationTemplate ??
    'Max duration: {engine} ({duration}).';
  const specTemplate =
    summaryCopy.specTemplate ??
    '{label}: {engine} ({leftValue} vs {rightValue}).';
  const resolutionTemplate =
    summaryCopy.resolutionTemplate ??
    'Max resolution: {engine} ({leftValue} vs {rightValue}).';
  const specWinnerRow: { id: string; icon: string; label: string; value: string; accent: OverallTone } | null = (() => {
    const valueForSupport = (label: string, leftValue: string, rightValue: string) => {
      const leftNormalized = leftValue.toLowerCase();
      const rightNormalized = rightValue.toLowerCase();
      const leftIsSupported = leftNormalized === 'supported' || leftNormalized.startsWith('supported ');
      const rightIsSupported = rightNormalized === 'supported' || rightNormalized.startsWith('supported ');
      if (leftIsSupported === rightIsSupported) return null;
      const winner = leftIsSupported ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label,
        value: formatTemplate(specTemplate, {
          label,
          engine: formatEngineName(winner === 'left' ? left : right),
          leftValue,
          rightValue,
        }),
        accent: winner as OverallTone,
      };
    };
    if (!isPending(leftSpecs.videoToVideo) && !isPending(rightSpecs.videoToVideo)) {
      const row = valueForSupport(
        specLabels.videoToVideo ?? 'Video-to-Video',
        leftSpecs.videoToVideo,
        rightSpecs.videoToVideo
      );
      if (row) return row;
    }
    if (!isPending(leftSpecs.firstLastFrame) && !isPending(rightSpecs.firstLastFrame)) {
      const row = valueForSupport(
        specLabels.firstLastFrame ?? 'First/Last frame',
        leftSpecs.firstLastFrame,
        rightSpecs.firstLastFrame
      );
      if (row) return row;
    }
    const leftRes = parseResolutionValue(leftSpecs.maxResolution);
    const rightRes = parseResolutionValue(rightSpecs.maxResolution);
    if (leftRes && rightRes && leftRes !== rightRes) {
      const winner = leftRes > rightRes ? 'left' : 'right';
      return {
        id: 'spec',
        icon: 'spec',
        label: specLabels.maxResolution ?? 'Max resolution',
        value: formatTemplate(resolutionTemplate, {
          engine: formatEngineName(winner === 'left' ? left : right),
          leftValue: leftSpecs.maxResolution,
          rightValue: rightSpecs.maxResolution,
        }),
        accent: winner as OverallTone,
      };
    }
    if (durationWinner) {
      return {
        id: 'duration',
        icon: 'duration',
        label: summaryCopy.durationLabel ?? 'Max duration',
        value: formatTemplate(durationTemplate, {
          engine: formatEngineName(durationWinner === 'left' ? left : right),
          duration: durationSummary,
        }),
        accent: durationWinner,
      };
    }
    return null;
  })();
  const winnerSummaryRows: Array<{ id: string; icon: string; label: string; value: string; accent: OverallTone | null }> = [];
  if (scoreLeader && topWinner) {
    winnerSummaryRows.push({
      id: 'scorecard',
      icon: 'scorecard',
      label: scorecardSummaryLabel,
      value: formatTemplate(scorecardTemplate, {
        engine: formatEngineName(topWinner),
        wins: String(scoreLeader === 'left' ? leftWins : rightWins),
        total: String(totalScored),
        best: topDeltas.length ? ` (${compareCopy.summary?.bestLabel ?? 'best'}: ${topDeltas.join(', ')})` : '',
      }),
      accent: scoreLeader,
    });
  }
  if (pricingWinner) {
    winnerSummaryRows.push({
      id: 'pricing',
      icon: 'pricing',
      label: summaryCopy.pricingLabel ?? 'Pricing',
      value: formatTemplate(pricingTemplate, {
        engine: formatEngineName(pricingWinner === 'left' ? left : right),
        pricing: pricingSummary,
        tarifs: pricingSummary,
      }),
      accent: pricingWinner,
    });
  }
  if (specWinnerRow) {
    winnerSummaryRows.push(specWinnerRow);
  } else if (durationWinner) {
    winnerSummaryRows.push({
      id: 'duration',
      icon: 'duration',
      label: summaryCopy.durationLabel ?? 'Max duration',
      value: formatTemplate(durationTemplate, {
        engine: formatEngineName(durationWinner === 'left' ? left : right),
        duration: durationSummary,
      }),
      accent: durationWinner,
    });
  }
  const summaryRows = winnerSummaryRows.slice(0, 3);
  const resolveSummaryMarker = (rowId: string, accent: OverallTone | null) => {
    if (rowId === 'pricing') {
      return 'rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.12)]';
    }
    if (rowId === 'scorecard' || rowId === 'spec' || rowId === 'duration') {
      return 'rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]';
    }
    if (accent === 'left') return clsx('rounded-full shadow-[0_0_0_4px_rgba(46,99,216,0.12)]', leftAccent.barClass);
    if (accent === 'right') return clsx('rounded-full shadow-[0_0_0_4px_rgba(46,99,216,0.12)]', rightAccent.barClass);
    return 'rounded-full bg-neutral-300';
  };
  const resolveSummaryLabelClass = (rowId: string) => {
    if (rowId === 'scorecard' || rowId === 'spec' || rowId === 'duration') {
      return 'text-emerald-600 dark:text-emerald-300';
    }
    if (rowId === 'pricing') {
      return 'text-orange-600 dark:text-orange-300';
    }
    return 'text-text-muted';
  };
  const formatWinnerSummaryValue = (row: { id: string; value: string }) => {
    if (row.id !== 'scorecard') return row.value;
    return row.value
      .replace(/^Leads on scorecard:\s*/i, '')
      .replace(/^Scorecard winner:\s*/i, '')
      .replace(/^Currently leads on scorecard \(provisional\):\s*/i, '');
  };
  const leftScoreStyle = getEngineToneVars(left, leftOverall);
  const rightScoreStyle = getEngineToneVars(right, rightOverall);
  const scorecardCriteriaLabel =
    activeLocale === 'fr' ? 'Critères' : activeLocale === 'es' ? 'Criterios' : 'Criteria';
  const generateWithLabel = formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
    engine: '',
  }).trim();
  const renderGenerateCard = (entry: EngineCatalogEntry, side: 'left' | 'right', canGenerate: boolean) => {
    const isLeft = side === 'left';
    const tone = isLeft
      ? {
          icon: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/25 dark:bg-orange-400/10',
          button:
            'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100 dark:border-orange-400/25 dark:bg-orange-400/10 dark:text-orange-200 dark:hover:bg-orange-400/15',
          link: 'text-orange-600 hover:text-orange-700 dark:text-orange-300 dark:hover:text-orange-200',
        }
      : {
          icon: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10',
          button:
            'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-200 dark:hover:bg-emerald-400/15',
          link: 'text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200',
        };

    return (
      <article className="rounded-[16px] border border-hairline bg-surface shadow-card">
        <div className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className={clsx('grid h-9 w-9 shrink-0 place-items-center rounded-full border shadow-sm', tone.icon)}>
              <EngineIcon
                engine={{ id: entry.modelSlug, label: formatEngineName(entry), brandId: entry.brandId }}
                size={20}
                rounded="full"
              />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-text-secondary">
                {generateWithLabel}
              </p>
              <p className="truncate text-base font-semibold leading-5 text-text-primary">
                {formatEngineName(entry)}
              </p>
            </div>
          </div>
          {canGenerate ? (
            <ButtonLink
              href={`/app?engine=${entry.modelSlug}`}
              variant="outline"
              size="sm"
              aria-label={formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                engine: formatEngineName(entry),
              })}
              className={clsx('h-10 w-10 shrink-0 rounded-[10px] p-0 shadow-none', tone.button)}
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
            </ButtonLink>
          ) : null}
        </div>
        <div className="border-t border-hairline px-4 py-3">
          <Link
            href={{ pathname: '/models/[slug]', params: { slug: entry.modelSlug } }}
            className={clsx('inline-flex items-center gap-1 text-xs font-semibold', tone.link)}
          >
            {compareCopy.scorecard?.fullProfile ?? 'Full engine profile'}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </article>
    );
  };

  return (
    <div className="relative isolate overflow-hidden">
      <div
        className="pointer-events-none absolute right-0 top-24 -z-10 h-[760px] w-[46vw] opacity-70 dark:opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, color-mix(in srgb, var(--brand) 30%, transparent) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          maskImage: 'linear-gradient(90deg, transparent, black 24%, black 74%, transparent)',
        }}
        aria-hidden
      />
      <div className="container-page max-w-[1040px] section">
        <div className="space-y-4 sm:space-y-5">
        <div className="text-sm text-text-muted">
          <Link href={compareHubHref} className="inline-flex items-center gap-2 font-semibold text-brand hover:text-brandHover">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {compareCopy.hero?.back ?? 'Back to comparisons'}
          </Link>
        </div>
        <header className="mx-auto max-w-[760px] py-6 text-center sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-micro text-text-muted">
            {compareCopy.hero?.kicker ?? 'Compare engines'}
          </p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.08] tracking-normal text-text-primary sm:text-[46px]">
            {formatEngineName(left)} vs {formatEngineName(right)}
          </h1>
          <p className="mt-4 text-sm leading-6 text-text-secondary">
            {formatTemplate(
              heroIntroTemplate,
              { left: formatEngineName(left), right: formatEngineName(right) }
            )}
          </p>
          {prelaunchNotice ? (
            <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-left shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-micro text-amber-900">{prelaunchNotice.title}</p>
              <p className="mt-1 text-sm text-amber-950">{prelaunchNotice.body}</p>
            </div>
          ) : null}
        </header>

        <section className="mx-auto max-w-[940px]">
          <div className="relative grid gap-4 md:grid-cols-2">
            <article className="relative flex overflow-visible rounded-[16px] border border-hairline bg-surface p-6 shadow-card">
              <div className="flex w-full flex-col items-center gap-5 sm:flex-row-reverse">
                <div
                  className="relative isolate grid h-[96px] w-[96px] shrink-0 place-items-center rounded-full p-[3px]"
                  style={leftScoreStyle}
                >
                  <span
                    className="pointer-events-none absolute -inset-5 -z-10 rounded-full opacity-75 blur-2xl"
                    style={{ background: 'color-mix(in srgb, var(--compare-accent) 45%, transparent)' }}
                    aria-hidden
                  />
                  <div className="grid h-full w-full place-items-center rounded-full border border-white/80 bg-surface text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-surface-2">
                    <div className="leading-none">
                      <span className="text-[28px] font-semibold tracking-normal text-text-primary">
                        {leftOverall != null ? leftOverall.toFixed(1) : '-'}
                      </span>
                      <span className="ml-0.5 align-super text-[10px] font-semibold text-text-muted">/10</span>
                      <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                        Score
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
                  <h2 className="text-2xl font-semibold tracking-normal text-text-primary">
                    {formatEngineName(left)}
                  </h2>
                  <CompareEngineSelector
                    options={resolvedLeftOptions}
                    value={left.modelSlug}
                    otherValue={right.modelSlug}
                    side="left"
                  />
                  {(() => {
                    const bestFor = localizeBestFor(left.bestFor, activeLocale);
                    const derived = deriveStrengths('left').join(', ');
                    const strengths = bestFor && !isPending(bestFor) ? bestFor : derived;
                    return strengths ? (
                      <p className="max-w-[280px] text-xs leading-5 text-text-secondary">
                        <span className="font-semibold text-text-primary">
                          {compareCopy.scorecard?.strengthsLabel ?? 'Strengths'}:
                        </span>{' '}
                        {strengths}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
            </article>

            <article className="relative flex overflow-visible rounded-[16px] border border-hairline bg-surface p-6 shadow-card">
              <div className="flex w-full flex-col items-center gap-5 sm:flex-row">
                <div
                  className="relative isolate grid h-[96px] w-[96px] shrink-0 place-items-center rounded-full p-[3px]"
                  style={rightScoreStyle}
                >
                  <span
                    className="pointer-events-none absolute -inset-5 -z-10 rounded-full opacity-75 blur-2xl"
                    style={{ background: 'color-mix(in srgb, var(--compare-accent) 45%, transparent)' }}
                    aria-hidden
                  />
                  <div className="grid h-full w-full place-items-center rounded-full border border-white/80 bg-surface text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-surface-2">
                    <div className="leading-none">
                      <span className="text-[28px] font-semibold tracking-normal text-text-primary">
                        {rightOverall != null ? rightOverall.toFixed(1) : '-'}
                      </span>
                      <span className="ml-0.5 align-super text-[10px] font-semibold text-text-muted">/10</span>
                      <span className="mt-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                        Score
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center">
                  <h2 className="text-2xl font-semibold tracking-normal text-text-primary">
                    {formatEngineName(right)}
                  </h2>
                  <CompareEngineSelector
                    options={resolvedRightOptions}
                    value={right.modelSlug}
                    otherValue={left.modelSlug}
                    side="right"
                  />
                  {(() => {
                    const bestFor = localizeBestFor(right.bestFor, activeLocale);
                    const derived = deriveStrengths('right').join(', ');
                    const strengths = bestFor && !isPending(bestFor) ? bestFor : derived;
                    return strengths ? (
                      <p className="max-w-[280px] text-xs leading-5 text-text-secondary">
                        <span className="font-semibold text-text-primary">
                          {compareCopy.scorecard?.strengthsLabel ?? 'Strengths'}:
                        </span>{' '}
                        {strengths}
                      </p>
                    ) : null;
                  })()}
                </div>
              </div>
            </article>

            <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 md:flex">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-bg bg-brand text-[11px] font-semibold uppercase tracking-micro text-on-brand shadow-[0_16px_34px_rgba(46,99,216,0.28)]">
                VS
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-[16px] border border-hairline bg-surface p-4 shadow-card sm:p-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-text-primary">
                {compareCopy.scorecard?.title ?? 'Scorecard (Side-by-Side)'}
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                {replaceCriteriaCount(
                  compareCopy.scorecard?.subtitle ??
                    `Scores reflect quality and control on MaxVideoAI across ${criteriaCount} criteria.`,
                  criteriaCount
                )}
              </p>
              {scorecardProvisionalNote ? (
                <p className="mt-2 text-xs font-semibold text-text-muted">{scorecardProvisionalNote}</p>
              ) : null}
            </div>
            <div className="mt-6 hidden items-center gap-3 text-[11px] font-semibold uppercase tracking-micro sm:grid sm:grid-cols-[minmax(0,1.6fr)_minmax(190px,1fr)_minmax(0,1.6fr)] sm:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(210px,1fr)_minmax(0,2fr)]">
              <span className="text-center text-brand">
                {formatEngineName(left)}
              </span>
              <span className="text-center text-text-muted">{scorecardCriteriaLabel}</span>
              <span className="text-center text-brand">
                {formatEngineName(right)}
              </span>
            </div>
            <CompareScoreboard
              metrics={comparisonMetrics}
              className="mt-4"
              naLabel={labels.na}
              pendingLabel={labels.pending}
            />

            <div className="mx-auto mt-7 w-full">
              <div className="relative overflow-hidden rounded-[18px] border border-[#cfe0ff] bg-[#eef5ff] px-5 pb-5 pt-5 text-center shadow-[0_16px_34px_rgba(46,99,216,0.10),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/10 dark:bg-[#172338] dark:shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
                <div
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#eaf2ff_0%,#f7fbff_58%,#ffffff_100%)] dark:bg-[linear-gradient(180deg,rgba(46,99,216,0.22)_0%,rgba(18,26,37,0.94)_58%,rgba(18,26,37,0.98)_100%)]"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute left-1/2 top-0 h-28 w-[340px] -translate-x-1/2 rounded-full bg-white/80 blur-2xl dark:bg-white/10"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/30"
                  aria-hidden
                />
                <div className="relative z-10 flex items-center justify-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white text-brand shadow-[0_12px_26px_rgba(46,99,216,0.14),inset_0_1px_0_rgba(255,255,255,0.95)] dark:border-white/10 dark:bg-white/8 dark:text-white">
                    <Trophy className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="text-lg font-semibold text-text-primary">
                    {winnerSummaryHeading}
                  </h3>
                </div>
                <div className="relative z-10 mt-4 grid gap-4">
                  {summaryRows.slice(0, 1).map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-col items-center gap-2 text-center"
                    >
                      <div className="flex items-center gap-2">
                        <span className={clsx('h-2 w-2 opacity-90', resolveSummaryMarker(row.id, row.accent))} />
                        <span className={clsx('text-[10px] font-semibold uppercase tracking-micro', resolveSummaryLabelClass(row.id))}>
                          {row.label}
                        </span>
                      </div>
                      <p className="max-w-[620px] text-sm leading-6 text-text-secondary">{formatWinnerSummaryValue(row)}</p>
                    </div>
                  ))}
                  <div className="grid gap-3 border-t border-[#dbe7fb] pt-4 sm:grid-cols-2 sm:divide-x sm:divide-[#dbe7fb] dark:border-white/10 dark:sm:divide-white/10">
                    {summaryRows.slice(1).map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col items-center gap-2 px-3 text-center"
                      >
                        <div className="flex items-center gap-2">
                          <span className={clsx('h-2 w-2 opacity-90', resolveSummaryMarker(row.id, row.accent))} />
                          <span className={clsx('text-[10px] font-semibold uppercase tracking-micro', resolveSummaryLabelClass(row.id))}>
                            {row.label}
                          </span>
                        </div>
                        <p className="text-sm leading-5 text-text-secondary">{row.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {renderGenerateCard(left, 'left', leftCanGenerate)}
            {renderGenerateCard(right, 'right', rightCanGenerate)}
          </div>

          <section className="mt-4 rounded-[16px] border border-hairline bg-surface p-6 shadow-card sm:p-8">
              <h2 className="text-center text-2xl font-semibold text-text-primary">
                {compareCopy.keySpecs?.title ?? 'Key Specs (Side-by-Side)'}
              </h2>
              <p className="mt-2 text-center text-sm text-text-secondary">
                {stripAudioReferencesForSilentPair(
                  compareCopy.keySpecs?.subtitle ??
                    'Compare key AI video model specs side-by-side (pricing, inputs, resolution, duration, aspect ratios, audio, and core controls). This is a high-level snapshot — see the full engine profile for the complete feature set and prompt examples.',
                  pairHasNativeAudio
                )}
              </p>

              <div className="mt-4 rounded-card border border-hairline bg-surface shadow-card">
                <div className="grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 border-b border-hairline px-3 py-3 text-[10px] font-semibold uppercase tracking-micro text-text-muted min-[840px]:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] min-[840px]:gap-4 min-[840px]:px-6 min-[840px]:py-4 min-[840px]:text-xs">
                  <span className="text-left">{formatEngineName(left)}</span>
                  <span className="text-center">{compareCopy.keySpecs?.keyLabel ?? 'Key spec'}</span>
                  <span className="text-right">{formatEngineName(right)}</span>
                </div>
                <div className="divide-y divide-hairline">
                  {specRows.map((row, index) => (
                    <div
                      key={row.label}
                      className={clsx(
                        'grid grid-cols-[minmax(90px,1fr)_minmax(80px,0.8fr)_minmax(90px,1fr)] gap-2 px-3 py-3 text-[11px] min-[840px]:grid-cols-[minmax(200px,2fr)_minmax(220px,1fr)_minmax(200px,2fr)] min-[840px]:gap-4 min-[840px]:px-6 min-[840px]:py-4 min-[840px]:text-sm',
                        index % 2 === 1 && 'bg-surface-2'
                      )}
                    >
                      <div className="rounded-md px-1 py-0.5 text-text-secondary sm:px-2 sm:py-1">
                        {renderSpecValue(row.left, activeLocale, {
                          pending: labels.pending,
                          supported: labels.supported,
                          notSupported: labels.notSupported,
                        })}
                        {'subline' in row && row.subline ? (
                          <div className="mt-1 text-[10px] text-text-muted">{row.subline}</div>
                        ) : null}
                      </div>
                      <span className="text-center text-text-primary">{row.label}</span>
                      <div className="rounded-md px-1 py-0.5 text-right text-text-secondary sm:px-2 sm:py-1">
                        {renderSpecValue(row.right, activeLocale, {
                          pending: labels.pending,
                          supported: labels.supported,
                          notSupported: labels.notSupported,
                        })}
                        {'rightSubline' in row && row.rightSubline ? (
                          <div className="mt-1 text-[10px] text-text-muted">{row.rightSubline}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {pageOverride?.topCards?.length ? (
                <section className="mt-6 rounded-[24px] border border-hairline bg-surface-2/70 p-4 shadow-sm sm:p-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    {pageOverride.topCards.map((card) => (
                      <article
                        key={card.title}
                        className="rounded-[18px] border border-hairline bg-surface/90 px-4 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                          {card.title}
                        </p>
                        <p className="mt-1.5 text-sm leading-6 text-text-secondary">{card.body}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {pageOverride?.primaryLinks?.length ? (
                <section className="mt-4 rounded-[24px] border border-hairline bg-surface/90 px-4 py-4 shadow-sm sm:px-5">
                  <h2 className="text-[11px] font-semibold uppercase tracking-micro text-text-muted">
                    {pageOverride.primaryLinksTitle ?? 'Recommended next steps'}
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    {pageOverride.primaryLinks.map((item) => (
                      <Link key={item.label} href={item.href} className="font-semibold text-brand hover:text-brandHover">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
          </section>
        </section>

        

        {showdownSlots.length ? (
          <section className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary">
              {compareCopy.showdown?.title ?? 'Showdown (same prompt)'}
            </h2>
            <p className="text-sm text-text-secondary">
              {showdownSubtitle}
            </p>
            <p className="text-xs text-text-muted">{compareCopy.showdown?.note ?? 'Showing up to 3 prompt pairs for clarity.'}</p>

            <div className="stack-gap-lg">
              {showdownSlots.map((entry) => {
                const leftLabel = entry.left.label ?? formatEngineName(left);
                const rightLabel = entry.right.label ?? formatEngineName(right);
                const leftAlt = getImageAlt({
                  kind: 'compareThumb',
                  engine: leftLabel,
                  compareEngine: rightLabel,
                  label: `${entry.title} - ${leftLabel}`,
                  locale: activeLocale,
                });
                const rightAlt = getImageAlt({
                  kind: 'compareThumb',
                  engine: rightLabel,
                  compareEngine: leftLabel,
                  label: `${entry.title} - ${rightLabel}`,
                  locale: activeLocale,
                });
                return (
                  <article
                    key={`${slug}-showdown-${entry.id}`}
                    className="rounded-card border border-hairline bg-surface p-6 shadow-card"
                  >
                    <div className="stack-gap-sm">
                    <div>
                      <h3 className="text-lg font-semibold text-text-primary">{entry.title}</h3>
                      <p className="text-sm text-text-secondary">
                        {labels.whatTests}: {entry.whatItTests}
                      </p>
                    </div>
                    <div className="rounded-card border border-hairline bg-surface-2 p-3 text-sm text-text-secondary">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{labels.prompt}</span>
                        {exposeSourcePrompt ? (
                          <CopyPromptButton
                            prompt={entry.prompt}
                            copyLabel={compareCopy.labels?.copyPrompt ?? 'Copy prompt'}
                            copiedLabel={compareCopy.labels?.copied ?? 'Copied'}
                          />
                        ) : null}
                      </div>
                      {exposeSourcePrompt ? (
                        <DeferredSourcePrompt
                          locale={activeLocale}
                          prompt={entry.prompt}
                          mode="details"
                          className="mt-2"
                          summaryClassName="cursor-pointer list-none text-xs font-semibold text-brand"
                          promptClassName="mt-2 whitespace-pre-wrap text-text-primary"
                          fallbackClassName="mt-2 text-sm text-text-secondary"
                        />
                      ) : (
                        <p className="mt-2 text-sm text-text-secondary">{localizedPromptNote}</p>
                      )}
                    </div>
                    <div className="grid grid-gap lg:grid-cols-2">
                      {renderShowdownMedia(
                        entry.left,
                        formatEngineName(left),
                        labels.placeholder,
                        labels.placeholder,
                        entry.aspectRatio,
                        leftAlt
                      )}
                      {renderShowdownMedia(
                        entry.right,
                        formatEngineName(right),
                        labels.placeholder,
                        labels.placeholder,
                        entry.aspectRatio,
                        rightAlt
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-text-secondary">
                      <span className="text-xs font-semibold uppercase tracking-micro text-text-muted">{showdownActionLabel}</span>
                      <Link
                        href={buildGenerateHref(
                          left.modelSlug,
                          exposeSourcePrompt ? entry.prompt : null,
                          entry.aspectRatio,
                          entry.mode
                        )}
                        prefetch={false}
                        className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                      >
                        {leftIsPrelaunch
                          ? labels.savePromptForLaunch
                          : formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                              engine: formatEngineShortName(left),
                            })}
                      </Link>
                      <Link
                        href={buildGenerateHref(
                          right.modelSlug,
                          exposeSourcePrompt ? entry.prompt : null,
                          entry.aspectRatio,
                          entry.mode
                        )}
                        prefetch={false}
                        className="rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-text-primary transition hover:bg-surface-2"
                      >
                        {rightIsPrelaunch
                          ? labels.savePromptForLaunch
                          : formatTemplate(compareCopy.scorecard?.generateWith ?? 'Generate with {engine}', {
                              engine: formatEngineShortName(right),
                            })}
                      </Link>
                      <span className="text-xs text-text-muted">{showdownActionHint}</span>
                    </div>
                  </div>
                  </article>
                );
              })}
            </div>
            <p className="text-sm text-text-secondary">
              {compareCopy.showdown?.footer ??
                'This side-by-side AI video comparison uses identical prompts to highlight differences in motion, realism, human fidelity, and text legibility. For full specs, controls, and more prompt examples, open each engine profile.'}
            </p>
          </section>
        ) : null}

        {relatedLinks.length ? (
          <section className="stack-gap-sm">
            <h2 className="text-2xl font-semibold text-text-primary">
              {compareCopy.related?.title ?? 'Related comparisons'}
            </h2>
            <p className="text-sm text-text-secondary">
              {compareCopy.related?.subtitle ??
                'Explore a few more popular side-by-side matchups.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {relatedLinks.map((item) => (
                <Link
                  key={item.href.params.slug}
                  href={item.href}
                  className="rounded-card border border-hairline bg-surface px-4 py-3 text-sm font-semibold text-text-primary transition hover:bg-surface-2"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="stack-gap-sm">
          <h2 className="text-2xl font-semibold text-text-primary">
            {pageOverride?.faq?.title ?? compareCopy.faq?.title ?? 'FAQ'}
          </h2>
          <p className="text-sm text-text-secondary">
            {formatTemplate(
              pageOverride?.faq?.subtitle ??
                compareCopy.faq?.subtitle ??
                'Quick answers about {left} vs {right} on MaxVideoAI (pricing, modes, specs, and why results differ).',
              { left: formatEngineName(left), right: formatEngineName(right) }
            )}
          </p>
          <div className="stack-gap-sm">
            {faqItems.map((item) => (
              <details key={item.question} className="rounded-card border border-hairline bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold text-text-primary">
                  {item.question}
                </summary>
                {Array.isArray(item.answer) ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-text-secondary">
                    {item.answer.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
                )}
              </details>
            ))}
          </div>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
          />
        </section>

        <div className="text-sm text-text-muted">
          <Link href={compareHubHref} className="font-semibold text-brand hover:text-brandHover">
            {compareCopy.hero?.back ?? 'Back to comparisons'}
          </Link>
        </div>
      </div>
    </div>
    </div>
  );
}
