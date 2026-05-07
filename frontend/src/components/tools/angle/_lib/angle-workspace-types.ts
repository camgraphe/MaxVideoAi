import type { AngleToolEngineId, AngleToolNumericParams, AngleToolResponse } from '@/types/tools-angle';

export type UploadedImage = {
  id?: string | null;
  url: string;
  previewUrl?: string | null;
  width?: number | null;
  height?: number | null;
  name?: string | null;
  source?: 'upload' | 'library' | 'paste' | 'example';
};

export type LibraryAsset = {
  id: string;
  url: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  size?: number | null;
  source?: string | null;
  createdAt?: string;
};

export type LibraryAssetsResponse = {
  ok: boolean;
  assets: LibraryAsset[];
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

export type AnglePreviewImage = {
  url: string;
  thumbUrl?: string | null;
};

export type RecentAngleJobEntry = {
  jobId: string;
  createdAt: string;
  engineLabel: string;
  outputs: AnglePreviewImage[];
};

export type PersistedAngleToolState = {
  version: 1;
  engineId: AngleToolEngineId;
  params: AngleToolNumericParams;
  safeMode: boolean;
  generateBestAngles: boolean;
  sourceImage: UploadedImage | null;
  result: AngleToolResponse | null;
  selectedOutputIndex: number;
};
