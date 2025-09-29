export type ProviderId = "veo" | "fal";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface StartJobInput {
  prompt: string;
  durationSeconds: number;
  ratio: "9:16" | "16:9";
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
  };
  advanced?: {
    fps?: number;
    motionStrength?: number;
    cfgScale?: number;
    steps?: number;
    watermark?: boolean;
    upscaling?: boolean;
  };
  metadata?: Record<string, string | number | boolean | null>;
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
}

export interface ProviderAdapter {
  startJob(input: StartJobInput): Promise<StartJobResult>;
  pollJob(providerJobId: string): Promise<PollJobResult>;
}
