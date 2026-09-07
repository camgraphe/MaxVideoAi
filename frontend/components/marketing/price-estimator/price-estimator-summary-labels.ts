type PriceEstimatorTranslate = (key: string, fallback: string) => string | null | undefined;

type BuildPriceEstimatorSummaryLabelsInput = {
  chargedNote: string;
  priceChipSuffix?: string | null;
  t: PriceEstimatorTranslate;
};

export function buildPriceEstimatorSummaryLabels({
  chargedNote,
  priceChipSuffix,
  t,
}: BuildPriceEstimatorSummaryLabelsInput) {
  return {
    audio: t('pricing.estimator.audioLabel', 'Audio') ?? 'Audio',
    audioIncluded: t('pricing.estimator.audioIncluded', 'Audio included by default') ?? 'Audio included by default',
    audioOff: t('pricing.estimator.audioOff', 'Off') ?? 'Off',
    audioOn: t('pricing.estimator.audioOn', 'On') ?? 'On',
    chargedNote,
    duration: t('pricing.estimator.durationLabel', 'Duration') ?? 'Duration',
    engine: t('pricing.estimator.engineLabel', 'Engine') ?? 'Engine',
    engineRate: t('pricing.estimator.engineRateLabel', 'Engine rate') ?? 'Engine rate',
    priceChipSuffix: priceChipSuffix ?? t('pricing.priceChipSuffix', 'Price before you generate.') ?? 'Price before you generate.',
    resolution: t('pricing.estimator.resolutionLabel', 'Resolution') ?? 'Resolution',
  };
}
