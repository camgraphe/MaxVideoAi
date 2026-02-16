import type { Mode, PricingSnapshot } from './engines';

export type ImageGenerationMode = Extract<Mode, 't2i' | 'i2i'>;

export interface ImageGenerationRequest {
  mode: ImageGenerationMode;
  prompt: string;
  numImages?: number;
  imageUrls?: string[];
  allowIndex?: boolean;
  indexable?: boolean;
  visibility?: 'public' | 'private';
  seed?: number;
  engineId?: string;
  membershipTier?: string;
  jobId?: string;
  aspectRatio?: string;
  resolution?: string;
}

export interface GeneratedImage {
  url: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
}

export interface ImageGenerationResponse {
  ok: boolean;
  mode: ImageGenerationMode;
  images: GeneratedImage[];
  description?: string | null;
  jobId?: string;
  requestId?: string;
  providerJobId?: string;
  durationMs?: number;
  costCents?: number;
  currency?: string;
  engineId?: string;
  engineLabel?: string;
  pricing?: PricingSnapshot;
  paymentStatus?: string;
  thumbUrl?: string | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
}
