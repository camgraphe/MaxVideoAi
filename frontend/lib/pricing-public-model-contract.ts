export type PublicModelQuoteInput = {
  modelId: string;
  mode: string;
  durationSec: number;
  resolution: string;
  audio?: boolean;
  aspectRatio?: string;
  quality?: string;
  quantity?: number;
  referenceImageCount?: number;
  inputVideoDurationSec?: number;
  inputAudioDurationSec?: number;
  referenceTokenBudget?: number;
};

export type PublicModelQuote =
  | { status: 'exact'; amountCents: number; currency: string; revision: string; scenarioLabel: string }
  | { status: 'unavailable' };
