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
  raw: unknown;
};
