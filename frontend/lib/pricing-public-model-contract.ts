export type PublicModelQuoteInput = {
  modelId: string;
  mode: string;
  durationSec: number;
  durationOption?: 'auto';
  resolution: string;
  audio?: boolean;
  voiceControl?: boolean;
  hdr?: boolean;
  exrExport?: boolean;
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
