'use client';

import { useMemo } from 'react';
import useSWR from 'swr';

import { authFetch } from '@/lib/authFetch';
import type { ImageGenerationMode } from '@/types/image-generation';
import { buildCustomImageSize } from '../_lib/image-workspace-utils';
import type { PricingEstimateResponse } from '../_lib/image-workspace-types';

type ImagePricingKey = [
  'image-pricing',
  string,
  ImageGenerationMode,
  number,
  string,
  string,
  boolean,
  string,
  string,
  string,
];

export function useImageWorkspacePricing({
  customImageHeight,
  customImageWidth,
  enableWebSearch,
  mode,
  numImages,
  quality,
  readyReferenceSizes,
  referenceSizeSignature,
  resolution,
  selectedEngineId,
}: {
  customImageHeight: string;
  customImageWidth: string;
  enableWebSearch: boolean;
  mode: ImageGenerationMode;
  numImages: number;
  quality: string | null;
  readyReferenceSizes: Array<{ width?: number | null; height?: number | null }>;
  referenceSizeSignature: string;
  resolution: string | null;
  selectedEngineId?: string | null;
}) {
  const priceEstimateKey = useMemo<ImagePricingKey | null>(() => {
    if (!selectedEngineId) return null;
    return [
      'image-pricing',
      selectedEngineId,
      mode,
      numImages,
      resolution ?? '',
      quality ?? '',
      enableWebSearch,
      customImageWidth,
      customImageHeight,
      referenceSizeSignature,
    ];
  }, [
    customImageHeight,
    customImageWidth,
    enableWebSearch,
    mode,
    numImages,
    quality,
    referenceSizeSignature,
    resolution,
    selectedEngineId,
  ]);

  const {
    data: pricingData,
    error: pricingError,
  } = useSWR(
    priceEstimateKey,
    async ([
      ,
      engineId,
      requestMode,
      count,
      requestResolution,
      requestQuality,
      requestEnableWebSearch,
      requestCustomWidth,
      requestCustomHeight,
    ]) => {
      const requestCustomImageSize =
        requestResolution === 'custom'
          ? buildCustomImageSize(requestCustomWidth, requestCustomHeight)
          : null;
      const response = await authFetch('/api/images/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineId,
          mode: requestMode,
          numImages: count,
          resolution: requestResolution || undefined,
          customImageSize: requestCustomImageSize,
          referenceImageSizes: readyReferenceSizes.length ? readyReferenceSizes : undefined,
          quality: requestQuality || undefined,
          enableWebSearch: requestEnableWebSearch || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as PricingEstimateResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error((payload as { error?: string } | null)?.error ?? 'Unable to estimate price');
      }
      return payload;
    },
    {
      keepPreviousData: true,
    }
  );

  return {
    pricingData,
    pricingError,
    pricingSnapshot: pricingData?.pricing ?? null,
  };
}
