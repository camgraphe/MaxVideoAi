import type { AppLocale } from '@/i18n/locales';
import { fetchPublicBenchmarkLatency } from '@/server/benchmark-lab-metrics';
import { withPublicPageTiming, withoutPublicPageTiming, type MeasurePublicPagePhase } from '@/server/public-page-timing';
import { loadCompareGallery } from './compare-gallery-loader';
import { getCompareReferenceDuration } from './compare-pricing-scenarios';
import { PRICING_ENGINES } from './compare-page-config';
import {
  buildSpecValues,
  computeOverall,
  isPrelaunchAvailability,
  loadEngineKeySpecs,
  loadEngineScores,
  resolvePricingDisplay,
} from './compare-page-helpers';
import type { EngineCatalogEntry } from './compare-page-types';

export async function buildCompareRouteData({
  activeLocale,
  left,
  right,
  measure = withoutPublicPageTiming,
}: {
  activeLocale: AppLocale;
  left: EngineCatalogEntry;
  right: EngineCatalogEntry;
  measure?: MeasurePublicPagePhase;
}) {
  const leftPricingEngine = PRICING_ENGINES.get(left.modelSlug);
  const rightPricingEngine = PRICING_ENGINES.get(right.modelSlug);
  const referenceDuration = getCompareReferenceDuration(leftPricingEngine, rightPricingEngine);
  const [latency, scores, keySpecs, leftPricingDisplay, rightPricingDisplay] = await Promise.all([
    measure('benchmark', () => fetchPublicBenchmarkLatency()),
    measure('scores', () => loadEngineScores()),
    measure('key-specs', () => loadEngineKeySpecs()),
    measure('left-pricing', () => resolvePricingDisplay(left, activeLocale, leftPricingEngine, undefined, referenceDuration)),
    measure('right-pricing', () => resolvePricingDisplay(right, activeLocale, rightPricingEngine, undefined, referenceDuration)),
  ]);
  const leftLatency = latency.rows.find((row) => row.engineId === left.engineId) ?? null;
  const rightLatency = latency.rows.find((row) => row.engineId === right.engineId) ?? null;
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
  const pairHasKling3Native4k =
    left.modelSlug === 'kling-3-4k' || right.modelSlug === 'kling-3-4k';
  const leftOverall = computeOverall(leftScore);
  const rightOverall = computeOverall(rightScore);
  const engineScoresBySlug = Object.fromEntries(
    Array.from(scores.entries())
      .map(([key, score]) => [key, computeOverall(score)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] != null)
  );
  const leftIsPrelaunch = isPrelaunchAvailability(left);
  const rightIsPrelaunch = isPrelaunchAvailability(right);

  return {
    criteriaCount,
    hasPrelaunchEngine: leftIsPrelaunch || rightIsPrelaunch,
    left,
    leftLatency,
    leftIsPrelaunch,
    leftOverall,
    leftPricingDisplay,
    leftScore,
    leftSpecs,
    engineScoresBySlug,
    pairHasKling3Native4k,
    pairHasNativeAudio,
    right,
    rightLatency,
    rightIsPrelaunch,
    rightOverall,
    rightPricingDisplay,
    rightScore,
    rightSpecs,
  };
}

export async function loadComparePageData(input: {
  activeLocale: AppLocale;
  left: EngineCatalogEntry;
  right: EngineCatalogEntry;
}) {
  return withPublicPageTiming({ route: 'comparison', locale: input.activeLocale }, async measure => {
    // These reads only depend on the resolved engines; none needs another read's result.
    const [routeData, leftGallery, rightGallery] = await Promise.all([
      buildCompareRouteData({ ...input, measure }),
      measure('left-gallery', () => loadCompareGallery(input.left, isPrelaunchAvailability(input.left))),
      measure('right-gallery', () => loadCompareGallery(input.right, isPrelaunchAvailability(input.right))),
    ]);
    return { routeData, leftGallery, rightGallery };
  });
}
