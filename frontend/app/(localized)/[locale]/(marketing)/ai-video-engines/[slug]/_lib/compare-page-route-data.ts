import type { AppLocale } from '@/i18n/locales';
import { isDatabaseConfigured } from '@/lib/db';
import { fetchEngineAverageDurations } from '@/server/generate-metrics';
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
}: {
  activeLocale: AppLocale;
  left: EngineCatalogEntry;
  right: EngineCatalogEntry;
}) {
  const averageDurations = isDatabaseConfigured() ? await fetchEngineAverageDurations() : [];
  const averageMap = new Map(averageDurations.map((entry) => [entry.engineId, entry.averageDurationMs]));
  const leftAverage = averageMap.get(left.engineId) ?? left.engine?.avgDurationMs ?? null;
  const rightAverage = averageMap.get(right.engineId) ?? right.engine?.avgDurationMs ?? null;
  const hydratedLeft = { ...left, engine: { ...left.engine, avgDurationMs: leftAverage } };
  const hydratedRight = { ...right, engine: { ...right.engine, avgDurationMs: rightAverage } };
  const scores = await loadEngineScores();
  const keySpecs = await loadEngineKeySpecs();
  const leftScore = scores.get(hydratedLeft.modelSlug) ?? scores.get(hydratedLeft.engineId) ?? null;
  const rightScore = scores.get(hydratedRight.modelSlug) ?? scores.get(hydratedRight.engineId) ?? null;
  const leftKeySpecs =
    keySpecs.get(hydratedLeft.modelSlug)?.keySpecs ?? keySpecs.get(hydratedLeft.engineId)?.keySpecs ?? undefined;
  const rightKeySpecs =
    keySpecs.get(hydratedRight.modelSlug)?.keySpecs ?? keySpecs.get(hydratedRight.engineId)?.keySpecs ?? undefined;
  const leftSpecs = buildSpecValues(hydratedLeft, leftKeySpecs);
  const rightSpecs = buildSpecValues(hydratedRight, rightKeySpecs);
  const pairHasNativeAudio = Boolean(hydratedLeft.engine?.audio) || Boolean(hydratedRight.engine?.audio);
  const criteriaCount = pairHasNativeAudio ? 11 : 10;
  const pairHasKling3Native4k =
    hydratedLeft.modelSlug === 'kling-3-4k' || hydratedRight.modelSlug === 'kling-3-4k';
  const [leftPricingDisplay, rightPricingDisplay] = await Promise.all([
    resolvePricingDisplay(hydratedLeft, activeLocale, PRICING_ENGINES.get(hydratedLeft.modelSlug)),
    resolvePricingDisplay(hydratedRight, activeLocale, PRICING_ENGINES.get(hydratedRight.modelSlug)),
  ]);
  const leftOverall = computeOverall(leftScore);
  const rightOverall = computeOverall(rightScore);
  const engineScoresBySlug = Object.fromEntries(
    Array.from(scores.entries())
      .map(([key, score]) => [key, computeOverall(score)] as const)
      .filter((entry): entry is readonly [string, number] => entry[1] != null)
  );
  const leftIsPrelaunch = isPrelaunchAvailability(hydratedLeft);
  const rightIsPrelaunch = isPrelaunchAvailability(hydratedRight);

  return {
    criteriaCount,
    hasPrelaunchEngine: leftIsPrelaunch || rightIsPrelaunch,
    left: hydratedLeft,
    leftIsPrelaunch,
    leftOverall,
    leftPricingDisplay,
    leftScore,
    leftSpecs,
    engineScoresBySlug,
    pairHasKling3Native4k,
    pairHasNativeAudio,
    right: hydratedRight,
    rightIsPrelaunch,
    rightOverall,
    rightPricingDisplay,
    rightScore,
    rightSpecs,
  };
}
