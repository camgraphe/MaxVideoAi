/** Reviewed launch authoring policy, never consulted by generation-time customer-price readers. */
export const FLUX_3_MAX_TARIFF_POLICY = 'flux_3_max_normal_list_plus_30_percent_v1';
export const FLUX_3_MAX_TARIFF_SCOPE = {
  modelId: 'flux-3-max', modes: ['t2v', 'i2v', 'fl2v', 'ref2v'], resolutions: ['720p', '1080p'],
  minimumDurationSec: 5, maximumDurationSec: 20, durationStepSec: 1, expectedCells: 128,
} as const;
