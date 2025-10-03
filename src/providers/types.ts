export type ProviderId = "veo" | "fal";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface StartJobInput {
  prompt: string;
  durationSeconds: number;
  ratio: "9:16" | "16:9" | "1:1" | "21:9" | "4:5" | "5:4" | "3:2" | "2:3";
  engine: string;
  withAudio: boolean;
  seed?: number;
  presetId?: string;
  modelId?: string;
  negativePrompt?: string;
  inputAssets?: {
    initImageUrl?: string;
    maskUrl?: string;
    referenceImageUrl?: string;
    referenceVideoUrl?: string;
    audioUrl?: string;
  };
  advanced?: {
    fps?: number;
    motionStrength?: number;
    cfgScale?: number;
    steps?: number;
    watermark?: boolean;
    upscaling?: boolean;
    enhancePrompt?: boolean;
    autoFix?: boolean;
  };
  metadata?: Record<string, string | number | boolean | null>;
  webhookUrl?: string;
}

export interface StartJobResult {
  jobId: string;
  provider: ProviderId;
  status: JobStatus;
  estimatedSeconds?: number;
  externalId?: string;
}

export interface PollJobResult {
  jobId: string;
  provider: ProviderId;
  status: JobStatus;
  progress: number;
  outputUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  costActualCents?: number;
  durationSeconds?: number;
  logs?: Array<{ message: string; timestamp?: string }>;
  asset?: {
    url: string;
    thumbnail?: string;
    durationSeconds?: number;
    contentType?: string;
    fileName?: string;
    fileSizeBytes?: number;
  };
}

export interface ProviderAdapter {
  startJob(input: StartJobInput): Promise<StartJobResult>;
  pollJob(
    providerJobId: string,
    options?: { withLogs?: boolean; engine?: string },
  ): Promise<PollJobResult>;
}
