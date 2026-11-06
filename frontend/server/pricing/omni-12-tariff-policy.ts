/** One-time authoring policy. Generation-time readers consume literal saved amounts. */
export const OMNI_12_TARIFF_POLICY = 'omni_1_2_saved_1_1_customer_times_1_5_v1';
export const OMNI_12_TARIFF_EVENT = 'gemini-omni-flash:1.2-customer-price-release';
export const OMNI_12_TARIFF_SCOPE = {
  modelId: 'gemini-omni-flash', providerModel: 'gemini-omni-1.2-flash',
  modes: ['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'extend', 'retake'],
  resolutions: ['360p', '720p', '1080p', '4k'], minimumDurationSec: 3, maximumDurationSec: 10,
  expectedCells: 456, fixedCells: 416, bandCells: 40,
  numerator: 3, denominator: 2, rounding: 'ceil_cent', basis: 'saved_1_1_customer_cents',
} as const;
