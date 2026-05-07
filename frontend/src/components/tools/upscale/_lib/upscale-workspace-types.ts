import type { UpscaleMediaType, UpscaleToolEngineId } from '@/types/tools-upscale';
import type { Job } from '@/types/jobs';

export type UploadedAsset = {
  id?: string | null;
  jobId?: string | null;
  url: string;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  name?: string | null;
};

export type PreviewMode = 'source' | 'result' | 'compare';
export type PreviewZoom = 'fit' | '100' | '200' | '400';

export type RecentUpscaleMedia = {
  url: string;
  thumbUrl?: string | null;
  mediaType: UpscaleMediaType;
  mimeType: string;
  source?: {
    url: string;
    assetId?: string | null;
    jobId?: string | null;
    width?: number | null;
    height?: number | null;
    mimeType: string;
  } | null;
  job: Job;
  engineLabel: string;
  engineId?: UpscaleToolEngineId | string;
  createdAt: string;
  totalCents: number | null;
  currency: string;
};

export type BillingProductResponse = {
  ok: boolean;
  product?: {
    productKey: string;
    currency: string;
    unitPriceCents: number;
  };
  error?: string;
};

export type UserAssetsResponse = {
  ok: boolean;
  assets?: Array<{
    id: string;
    url: string;
    mime?: string | null;
    width?: number | null;
    height?: number | null;
    size?: number | null;
    source?: string | null;
    createdAt?: string;
  }>;
  error?: string;
};

export type JobDetailResponse = Partial<Job> & {
  ok?: boolean;
  pricing?: Job['pricingSnapshot'];
  error?: string;
};

export type JobsLibraryResponse = {
  ok?: boolean;
  jobs?: Array<{
    jobId: string;
    videoUrl?: string | null;
    readyVideoUrl?: string | null;
    createdAt?: string;
  }>;
  error?: string;
};
