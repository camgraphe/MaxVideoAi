export type NormalizedVideoProviderStatus = 'queued' | 'running' | 'completed' | 'failed';

export type NormalizedVideoProviderUsage = {
  totalTokens: number | null;
  completionTokens: number | null;
};

export type NormalizedVideoProviderTask = {
  providerJobId: string;
  status: NormalizedVideoProviderStatus;
  rawStatus: string | null;
  videoUrl: string | null;
  message: string | null;
  usage: NormalizedVideoProviderUsage | null;
  providerCostUnits?: number | null;
  providerCostUsd?: number | null;
  raw: unknown;
};

export type VideoProviderKey =
  | 'fal'
  | 'kling_direct'
  | 'byteplus_modelark'
  | 'google_vertex_veo_direct'
  | 'google_vertex_omni_direct'
  | 'luma_agents_direct'
  | 'luma_direct';

export type ProviderSubmitInput = {
  publicJobId: string;
  engineId: string;
  mode: string;
  prompt: string;
  negativePrompt?: string | null;
  durationSec: number;
  aspectRatio?: string | null;
  audioEnabled?: boolean;
  imageUrl?: string | null;
  cfgScale?: number | null;
  resolution?: string | null;
};

export type ProviderSubmitResult = {
  provider: VideoProviderKey;
  providerJobId: string;
  providerModel: string | null;
  status: NormalizedVideoProviderStatus;
  raw: unknown;
};

export type ProviderPollInput = {
  providerJobId: string;
  engineId: string;
  mode?: string;
  pollPathPrefix?: string;
};

export type ProviderPollResult = NormalizedVideoProviderTask;

export type ProviderCostInput = {
  engineId: string;
  mode?: string | null;
  durationSec: number;
  audioEnabled?: boolean;
  resolution?: string | null;
};

export type ProviderCostEstimate = {
  providerCostUnits: number | null;
  providerCostUsd: number | null;
  source: string;
};

export type NormalizedProviderError = {
  provider: VideoProviderKey;
  message: string;
  status: number | null;
  code: string | null;
  errorClass: string;
  fallbackEligible: boolean;
  raw: unknown;
};

export type VideoProviderAdapter = {
  key: VideoProviderKey;
  submit(input: ProviderSubmitInput): Promise<ProviderSubmitResult>;
  poll(input: ProviderPollInput): Promise<ProviderPollResult>;
  normalizeResult(raw: unknown): NormalizedVideoProviderTask;
  normalizeError(error: unknown): NormalizedProviderError;
  estimateCost(input: ProviderCostInput): ProviderCostEstimate;
};
