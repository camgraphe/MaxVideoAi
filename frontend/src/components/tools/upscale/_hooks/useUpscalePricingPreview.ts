import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { authFetch } from '@/lib/authFetch';
import {
  buildUpscalePricingPreview,
  type UpscaleVideoPricingMetadata,
} from '@/lib/tools-upscale';
import type { UpscaleToolEngineDefinition } from '@/types/tools-upscale';
import type {
  UpscaleMediaType,
  UpscaleMode,
  UpscaleTargetResolution,
} from '@/types/tools-upscale';
import {
  formatCurrency,
  readVideoPricingMetadata,
} from '../_lib/upscale-workspace-helpers';
import type {
  BillingProductResponse,
  UploadedAsset,
} from '../_lib/upscale-workspace-types';

interface UseUpscalePricingPreviewParams {
  copy: {
    priceLoading: string;
    priceReady: string;
    priceUnavailable: string;
    priceVideoLoading: string;
    priceVideoMissing: string;
  };
  engine: UpscaleToolEngineDefinition;
  locale: string;
  mediaType: UpscaleMediaType;
  mediaUrl: string;
  mode: UpscaleMode;
  source: UploadedAsset | null;
  targetResolution: UpscaleTargetResolution;
  upscaleFactor: number;
}

export function useUpscalePricingPreview({
  copy,
  engine,
  locale,
  mediaType,
  mediaUrl,
  mode,
  source,
  targetResolution,
  upscaleFactor,
}: UseUpscalePricingPreviewParams) {
  const [videoMetadata, setVideoMetadata] = useState<UpscaleVideoPricingMetadata | null>(null);
  const [videoMetadataLoading, setVideoMetadataLoading] = useState(false);
  const billingProductKey = engine?.billingProductKey ?? null;
  const {
    data: billingProductData,
    error: billingProductError,
    isLoading: billingProductLoading,
  } = useSWR(
    billingProductKey ? `/api/billing-products?productKey=${encodeURIComponent(billingProductKey)}` : null,
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? copy.priceUnavailable);
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );

  useEffect(() => {
    const url = mediaUrl.trim();
    if (mediaType !== 'video' || !url) {
      setVideoMetadata(null);
      setVideoMetadataLoading(false);
      return;
    }

    let cancelled = false;
    setVideoMetadata(null);
    setVideoMetadataLoading(true);
    readVideoPricingMetadata(url)
      .then((metadata) => {
        if (!cancelled) setVideoMetadata(metadata);
      })
      .catch(() => {
        if (!cancelled) setVideoMetadata(null);
      })
      .finally(() => {
        if (!cancelled) setVideoMetadataLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaType, mediaUrl]);

  const pricePreview = useMemo(
    () =>
      buildUpscalePricingPreview({
        mediaType,
        engineId: engine.id,
        unitPriceCents: billingProductData?.unitPriceCents ?? null,
        currency: billingProductData?.currency ?? 'USD',
        imageWidth: mediaType === 'image' ? source?.width ?? null : null,
        imageHeight: mediaType === 'image' ? source?.height ?? null : null,
        videoMetadata: mediaType === 'video' ? videoMetadata : null,
        targetResolution: mode === 'target' ? targetResolution : null,
        upscaleFactor,
      }),
    [
      billingProductData?.currency,
      billingProductData?.unitPriceCents,
      engine.id,
      mediaType,
      mode,
      source?.height,
      source?.width,
      targetResolution,
      upscaleFactor,
      videoMetadata,
    ]
  );
  const priceLabel = formatCurrency(pricePreview.totalCents, pricePreview.currency, locale);
  const priceHint = billingProductLoading
    ? copy.priceLoading
    : billingProductError
      ? copy.priceUnavailable
      : mediaType === 'video' && videoMetadataLoading
        ? copy.priceVideoLoading
        : mediaType === 'video' && !pricePreview.ready
          ? copy.priceVideoMissing
          : copy.priceReady;

  return {
    priceHint,
    priceLabel,
    pricePreview,
    videoMetadata,
    videoMetadataLoading,
  };
}
