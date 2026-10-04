'use client';

import { useEffect, useMemo } from 'react';
import { CUSTOMER_PRICING_REFRESH_EVENT } from '@/lib/customer-tariff-revision';
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
  string,
  number,
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
  aspectRatio,
  referenceImageCount,
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
  aspectRatio: string | null;
  referenceImageCount: number;
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
      aspectRatio ?? '',
      referenceImageCount,
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
    aspectRatio,
    referenceImageCount,
  ]);

  const {
    data: pricingData,
    error: pricingError,
    mutate,
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
      ,
      requestAspectRatio,
      requestReferenceImageCount,
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
          aspectRatio: requestAspectRatio || undefined,
          referenceImageCount: requestReferenceImageCount,
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
      keepPreviousData: false,
    }
  );
  useEffect(() => {
    const refresh = () => { void mutate(undefined, { revalidate: true }); };
    window.addEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
    return () => window.removeEventListener(CUSTOMER_PRICING_REFRESH_EVENT, refresh);
  }, [mutate]);

  return {
    pricingData,
    pricingError,
    pricingSnapshot: pricingData?.pricing ?? null,
  };
}
