import type { BackgroundRemovalToolOutput, BackgroundRemovalToolResponse } from '@/types/tools-background-removal';
import type { Job } from '@/types/jobs';

export type BackgroundRemovalVideoMetadata = {
  width: number | null;
  height: number | null;
  durationSec: number;
  fps?: number | null;
};

export type BackgroundRemovalSourceAsset = {
  id?: string | null;
  jobId?: string | null;
  url: string;
  name?: string | null;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  thumbUrl?: string | null;
};

export type BackgroundRemovalResult = BackgroundRemovalToolResponse & {
  output?: BackgroundRemovalToolOutput | null;
};

export type BillingProductResponse = {
  ok?: boolean;
  error?: string;
  product?: {
    productKey: string;
    currency: string;
    unitPriceCents: number;
    active: boolean;
  } | null;
};

export type MediaLibraryAssetResponse = {
  ok?: boolean;
  assets?: Array<{
    id: string;
    kind: 'image' | 'video' | 'audio';
    url: string;
    thumbUrl?: string | null;
    previewUrl?: string | null;
    mimeType?: string | null;
    width?: number | null;
    height?: number | null;
    source?: string | null;
    sourceJobId?: string | null;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  }>;
  error?: string;
};

export type RecentBackgroundRemovalResult = {
  job: Job;
  url: string;
  thumbUrl?: string | null;
  mimeType?: string | null;
  createdAt: string;
  engineLabel: string;
  totalCents?: number | null;
  currency?: string | null;
};
