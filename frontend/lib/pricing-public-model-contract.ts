export type PublicModelQuoteInput = {
  modelId: string;
  mode: string;
  durationSec: number;
  resolution: string;
  audio?: boolean;
  voiceControl?: boolean;
  aspectRatio?: string;
  quality?: string;
  quantity?: number;
  referenceImageCount?: number;
  hasVideoInput?: boolean;
  inputVideoDurationSec?: number;
  inputAudioDurationSec?: number;
  referenceTokenBudget?: number;
  customImageSize?: { width: number; height: number };
};

export type PublicModelQuote =
  | { status: 'exact'; amountCents: number; currency: string; revision: string; scenarioLabel: string }
  | { status: 'unavailable' };
