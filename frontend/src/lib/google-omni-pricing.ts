export type GoogleOmniPricingInput = {
  outputResolution: '360p' | '720p' | '1080p' | '4k';
  outputDurationSec: number;
  inputImageCount: number;
  inputVideoDurationSec: number;
};

export const GOOGLE_OMNI_OUTPUT_TOKENS_PER_SECOND = {
  '360p': 1_931,
  '720p': 5_792,
  '1080p': 8_688,
  '4k': 17_376,
} as const;

export const GOOGLE_OMNI_OUTPUT_USD_PER_MILLION_TOKENS = 17.5;
export const GOOGLE_OMNI_INPUT_IMAGE_TOKENS = 1_120;
export const GOOGLE_OMNI_INPUT_VIDEO_TOKENS_PER_SECOND = 5_792;
export const GOOGLE_OMNI_INPUT_USD_PER_MILLION_TOKENS = 1.5;
export const GOOGLE_OMNI_PRICING_SOURCE = 'google_omni_1_1_token_pricing';

export type GoogleOmniPricingBreakdown = {
  outputTokens: number;
  inputImageTokens: number;
  inputVideoTokens: number;
  providerCostUsd: number;
  providerCostExactCents: number;
  providerCostCents: number;
};

export type GoogleOmniPricingContext = {
  outputResolution: string;
  outputDurationSec: number;
  inheritedDurationSec?: number;
  mode?: string | null;
  inputImageCount?: number;
  referenceImageCount?: number;
  inputVideoDurationSec?: number;
};

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Google Omni ${label} must be a non-negative finite number.`);
  }
}

export function calculateGoogleOmniProviderCost(input: GoogleOmniPricingInput): GoogleOmniPricingBreakdown {
  if (!Number.isInteger(input.outputDurationSec) || input.outputDurationSec < 3 || input.outputDurationSec > 10) {
    throw new Error('Google Omni output duration must be an integer from 3 through 10 seconds.');
  }
  if (!Number.isInteger(input.inputImageCount) || input.inputImageCount < 0) {
    throw new Error('Google Omni input image count must be a non-negative integer.');
  }
  assertNonNegativeFinite(input.inputVideoDurationSec, 'input video duration');

  const outputTokens = GOOGLE_OMNI_OUTPUT_TOKENS_PER_SECOND[input.outputResolution] * input.outputDurationSec;
  const inputImageTokens = GOOGLE_OMNI_INPUT_IMAGE_TOKENS * input.inputImageCount;
  const inputVideoTokens = GOOGLE_OMNI_INPUT_VIDEO_TOKENS_PER_SECOND * input.inputVideoDurationSec;
  const pricedTokenUnits =
    outputTokens * GOOGLE_OMNI_OUTPUT_USD_PER_MILLION_TOKENS
    + (inputImageTokens + inputVideoTokens) * GOOGLE_OMNI_INPUT_USD_PER_MILLION_TOKENS;
  const providerCostUsd = pricedTokenUnits / 1_000_000;
  const providerCostExactCents = pricedTokenUnits / 10_000;

  return {
    outputTokens,
    inputImageTokens,
    inputVideoTokens,
    providerCostUsd,
    providerCostExactCents,
    providerCostCents: Math.round(providerCostExactCents),
  };
}

export function calculateGoogleOmniProviderCostCents(input: GoogleOmniPricingInput): number {
  return calculateGoogleOmniProviderCost(input).providerCostCents;
}

export function resolveGoogleOmniPricingInput(context: GoogleOmniPricingContext): GoogleOmniPricingInput {
  const outputResolution = context.outputResolution;
  if (outputResolution !== '360p' && outputResolution !== '720p' && outputResolution !== '1080p' && outputResolution !== '4k') {
    throw new Error('Google Omni pricing requires a 360p, 720p, 1080p, or 4k output resolution.');
  }

  const mode = context.mode ?? 't2v';
  const inheritsOutputTiming = mode === 'v2v' || mode === 'retake';
  if (inheritsOutputTiming && context.inheritedDurationSec === undefined) {
    throw new Error('Google Omni exact pricing requires trusted inherited duration metadata for edit modes.');
  }
  const inferredImageCount = mode === 'i2v' ? 1 : mode === 'fl2v' ? 2 : 0;
  const inputImageCount = context.inputImageCount
    ?? (mode === 'ref2v' ? context.referenceImageCount : undefined)
    ?? inferredImageCount;
  if ((mode === 'v2v' || mode === 'extend') && context.inputVideoDurationSec === undefined) {
    throw new Error('Google Omni exact pricing requires verified source video duration metadata.');
  }

  return {
    outputResolution,
    outputDurationSec: inheritsOutputTiming ? context.inheritedDurationSec! : context.outputDurationSec,
    inputImageCount,
    inputVideoDurationSec: context.inputVideoDurationSec ?? 0,
  };
}
