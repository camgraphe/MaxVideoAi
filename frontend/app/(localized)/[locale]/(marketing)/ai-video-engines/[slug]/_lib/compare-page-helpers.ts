export { hydrateShowdowns, loadEngineKeySpecs, loadEngineScores } from './compare-page-data-loaders';
export {
  formatEngineMetaName,
  formatEngineName,
  formatEngineShortName,
  formatSpeedChip,
  getEngineAccent,
  getEngineToneVars,
} from './compare-page-engine-formatting';
export type { EngineAccent, OverallTone } from './compare-page-engine-formatting';
export {
  LOCALIZED_SHOWDOWN_TESTS,
  LOCALIZED_SHOWDOWN_TITLES,
  localizeBestFor,
  localizeMappedValue,
} from './compare-page-localization';
export {
  computePricingScore,
  formatPriceLabel,
  formatPriceLine,
  getPrelaunchCompareNotice,
  getPrelaunchPricingLabel,
  getPricePerSecondCents,
  isEngineGeneratable,
  isPrelaunchAvailability,
  parseResolutionLabel,
  resolveAudioOffPrice,
  resolvePricingDisplay,
} from './compare-page-pricing';
export {
  buildGenerateHref,
  getCanonicalCompareSlug,
  resolveEngines,
  resolveExcludedCompareRedirect,
  reverseCompareSlug,
} from './compare-page-routing';
export {
  computeOverall,
  computePairScores,
  formatCapabilityValue,
  getFallbackCapabilityDifference,
  parseFirstNumber,
  parseResolutionValue,
  pickCapabilityDifference,
  pickFirstCapabilityDifference,
  pickOutputDifference,
} from './compare-page-score-utils';
export {
  buildSpecValues,
  formatAspectRatios,
  formatDuration,
  formatFps,
  formatMaxResolution,
  isPending,
  localizeSpecDetailValue,
  resolveFirstLastSupport,
  resolveKeySpecValue,
  resolveModeSupported,
  resolveReferenceImageSupport,
  resolveReferenceVideoSupport,
  resolveStatus,
  resolveVideoToVideoSupport,
} from './compare-page-spec-values';
export {
  formatTemplate,
  replaceCriteriaCount,
  stripAudioReferencesForSilentPair,
} from './compare-page-text';
