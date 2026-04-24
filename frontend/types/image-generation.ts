import type { Mode, PricingSnapshot } from './engines';

export type ImageGenerationMode = Extract<Mode, 't2i' | 'i2i'>;

export interface CharacterReferenceSelection {
  id: string;
  jobId: string;
  imageUrl: string;
  thumbUrl?: string | null;
  prompt?: string | null;
  createdAt?: string | null;
  engineLabel?: string | null;
  outputMode?: 'portrait-reference' | 'character-sheet' | null;
  action?: 'generate' | 'full-body-fix' | 'lighting-variant' | null;
}

export interface ImageGenerationRequest {
  mode: ImageGenerationMode;
  prompt: string;
  numImages?: number;
  imageUrls?: string[];
  referenceImageSizes?: Array<{
    width?: number | null;
    height?: number | null;
  }>;
  characterReferences?: CharacterReferenceSelection[];
  allowIndex?: boolean;
  indexable?: boolean;
  visibility?: 'public' | 'private';
  seed?: number;
  outputFormat?: 'jpeg' | 'png' | 'webp';
  quality?: 'low' | 'medium' | 'high';
  maskUrl?: string;
  enableWebSearch?: boolean;
  thinkingLevel?: 'minimal' | 'high';
  limitGenerations?: boolean;
  engineId?: string;
  membershipTier?: string;
  jobId?: string;
  aspectRatio?: string;
  resolution?: string;
  customImageSize?: {
    width: number;
    height: number;
  } | null;
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

export interface CharacterReferencesResponse {
  ok: boolean;
  characters: CharacterReferenceSelection[];
  error?: string;
}
