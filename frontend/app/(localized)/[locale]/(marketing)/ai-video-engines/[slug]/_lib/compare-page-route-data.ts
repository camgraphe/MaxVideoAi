import type { AppLocale } from '@/i18n/locales';
import { fetchPublicBenchmarkLatency } from '@/server/benchmark-lab-metrics';
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
  const latency = await fetchPublicBenchmarkLatency();
  const leftLatency = latency.rows.find((row) => row.engineId === left.engineId) ?? null;
  const rightLatency = latency.rows.find((row) => row.engineId === right.engineId) ?? null;
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
  const pairHasKling3Native4k =
    left.modelSlug === 'kling-3-4k' || right.modelSlug === 'kling-3-4k';
  const [leftPricingDisplay, rightPricingDisplay] = await Promise.all([
    resolvePricingDisplay(left, activeLocale, PRICING_ENGINES.get(left.modelSlug)),
    resolvePricingDisplay(right, activeLocale, PRICING_ENGINES.get(right.modelSlug)),
  ]);
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
