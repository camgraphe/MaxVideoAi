import type { QueueStatus } from '@fal-ai/client';
import type { SoraRequest } from '@/lib/sora';
import type { ResultProviderMode } from '@/types/providers';
import type { VideoAsset } from '@/types/render';

export type GenerateAttachment = {
  name: string;
  type: string;
  size: number;
  kind?: 'image' | 'video' | 'audio';
  slotId?: string;
  label?: string;
  url?: string;
  dataUrl?: string;
  width?: number | null;
  height?: number | null;
  assetId?: string;
};

export type GeneratePayload = {
  engineId: string;
  prompt: string;
  durationSec?: number;
  durationOption?: number | string | null;
  numFrames?: number | null;
  aspectRatio?: string;
  resolution?: string;
  fps?: number;
  mode?: string;
  audio?: boolean;
  apiKey?: string;
  idempotencyKey?: string;
  imageUrl?: string;
  audioUrl?: string;
  referenceImages?: string[];
  inputs?: GenerateAttachment[];
  soraRequest?: SoraRequest;
  jobId?: string;
  localKey?: string | null;
  loop?: boolean;
  cfgScale?: number | null;
  multiPrompt?: Array<{ prompt: string; duration: number }>;
  shotType?: 'customize' | 'intelligent';
  seed?: number;
  cameraFixed?: boolean;
  safetyChecker?: boolean;
  voiceIds?: string[];
  elements?: Array<{ frontalImageUrl?: string; referenceImageUrls?: string[]; videoUrl?: string }>;
  endImageUrl?: string;
  extraInputValues?: Record<string, unknown>;
};

export type GenerateResult = {
  provider: ResultProviderMode;
  thumbUrl: string;
  videoUrl?: string;
  video?: VideoAsset;
  providerJobId?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed';
  progress?: number;
};

export type GenerateHooks = {
  onRequestId?: (requestId: string) => void | Promise<void>;
  onQueueUpdate?: (status: QueueStatus) => void | Promise<void>;
};
