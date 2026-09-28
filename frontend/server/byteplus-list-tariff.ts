/** Public ModelArk list prices. Account discounts and invoices have separate provenance. */
export const BYTEPLUS_MODELARK_LIST_PRICE_SOURCE = {
  url: 'https://docs.byteplus.com/en/docs/ModelArk/1544106',
  checkedAt: '2026-09-28',
  currency: 'USD',
} as const;

type VideoRate = Readonly<{ noVideoInput: number; videoInput: number }>;
type VideoProfile = 'standard' | 'fast' | 'mini' | 'seedance25';

const LIMITED_CAMPAIGN = {
  startsAt: '2026-08-07T06:00:00.000Z',
  endsAt: '2026-10-07T06:00:00.000Z',
  status: 'published_temporary_promotion' as const,
};

const VIDEO_RATES_USD_PER_1K_TOKENS: Readonly<Record<VideoProfile, Readonly<Record<string, VideoRate>>>> = {
  standard: {
    '480p': { noVideoInput: 0.007, videoInput: 0.0043 },
    '720p': { noVideoInput: 0.007, videoInput: 0.0043 },
    '1080p': { noVideoInput: 0.0077, videoInput: 0.0047 },
    '4k': { noVideoInput: 0.004, videoInput: 0.0024 },
  },
  fast: {
    '480p': { noVideoInput: 0.0056, videoInput: 0.0033 },
    '720p': { noVideoInput: 0.0056, videoInput: 0.0033 },
  },
  mini: {
    '480p': { noVideoInput: 0.0035, videoInput: 0.0021 },
    '720p': { noVideoInput: 0.0035, videoInput: 0.0021 },
  },
  seedance25: {
    '480p': { noVideoInput: 0.0107, videoInput: 0.0064 },
    '720p': { noVideoInput: 0.0107, videoInput: 0.0064 },
    '1080p': { noVideoInput: 0.0117, videoInput: 0.007 },
  },
};

export function getBytePlusVideoListRate(input: {
  profile: VideoProfile;
  resolution: string;
  billingInputType: 'no_video_input' | 'video_input';
}) {
  const rates = VIDEO_RATES_USD_PER_1K_TOKENS[input.profile][input.resolution.toLowerCase()];
  if (!rates) throw new Error(`Unsupported BytePlus ${input.profile} resolution: ${input.resolution}`);
  const unitPriceUsdPer1kTokens = input.billingInputType === 'video_input' ? rates.videoInput : rates.noVideoInput;
  const promotionFactor = input.profile === 'fast' ? 0.75 : input.profile === 'mini' ? 0.4 : null;
  return {
    unitPriceUsdPer1kTokens,
    unit: 'USD / 1,000 tokens' as const,
    status: 'published_list' as const,
    source: BYTEPLUS_MODELARK_LIST_PRICE_SOURCE,
    promotion: promotionFactor === null ? null : {
      unitPriceUsdPer1kTokens: Number((unitPriceUsdPer1kTokens * promotionFactor).toFixed(9)),
      ...LIMITED_CAMPAIGN,
    },
    effectiveUnitPriceUsdPer1kTokens: null,
  };
}

/** The public campaign is evidence, not a confirmed account-specific invoice rate. */
export function getPublishedPromotionAt(
  rate: ReturnType<typeof getBytePlusVideoListRate>,
  at: string,
) {
  const instant = Date.parse(at);
  if (!Number.isFinite(instant) || !rate.promotion) return null;
  return instant >= Date.parse(rate.promotion.startsAt) && instant < Date.parse(rate.promotion.endsAt)
    ? rate.promotion
    : null;
}

export function getSeedance15ListRate(input: { audio: boolean; step: 'normal' | 'draft' | 'final' }) {
  return {
    unitPriceUsdPer1kTokens: input.audio ? 0.0024 : 0.0012,
    tokenMultiplier: input.step === 'draft' ? (input.audio ? 0.6 : 0.7) : 1,
    effectiveUnitPriceUsdPer1kTokens: null,
  };
}

/** Draft uses a 480p task; the later 1080p render is a second paid task. */
export function getSeedance25StepListRate(input: {
  step: 'draft' | 'final';
  billingInputType: 'no_video_input' | 'video_input';
}) {
  const resolution = input.step === 'draft' ? '480p' : '1080p';
  return {
    ...getBytePlusVideoListRate({ profile: 'seedance25', resolution, billingInputType: input.billingInputType }),
    resolution,
    billing: 'separate_task' as const,
  };
}

/** Estimates a successful Seedream generation from actual output pixel counts. */
export function quoteSeedreamListCost(input: {
  model: 'lite' | 'pro';
  outputPixels: number[];
  inputImages: number;
}) {
  if (!Number.isSafeInteger(input.inputImages) || input.inputImages < 0 ||
      input.outputPixels.some((pixels) => !Number.isSafeInteger(pixels) || pixels < 1)) {
    throw new Error('Invalid Seedream usage.');
  }
  const outputUsd = input.outputPixels.reduce((total, pixels) => {
    if (input.model === 'lite') return total + 0.035;
    return total + (pixels <= 2_610_000 ? 0.045 : 0.09);
  }, 0);
  const inputUsd = input.model === 'pro' && input.outputPixels.length > 0
    ? Math.max(0, input.inputImages - 1) * 0.003
    : 0;
  return {
    outputUsd: Number(outputUsd.toFixed(6)),
    inputUsd: Number(inputUsd.toFixed(6)),
    totalUsd: Number((outputUsd + inputUsd).toFixed(6)),
    effectiveUsd: null,
    status: 'published_list' as const,
    source: BYTEPLUS_MODELARK_LIST_PRICE_SOURCE,
  };
}
