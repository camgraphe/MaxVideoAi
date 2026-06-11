import { useMemo } from 'react';
import useSWR from 'swr';
import { authFetch } from '@/lib/authFetch';
import { buildBackgroundRemovalPricingPreview } from '@/lib/tools-background-removal';
import type { BackgroundRemovalOutputCodec } from '@/types/tools-background-removal';
import { formatCurrency } from '../_lib/background-removal-workspace-helpers';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
import type {
  BackgroundRemovalVideoMetadata,
  BillingProductResponse,
} from '../_lib/background-removal-workspace-types';

export function useBackgroundRemovalPricingPreview(params: {
  copy: BackgroundRemovalWorkspaceCopy;
  locale: string;
  metadata: BackgroundRemovalVideoMetadata | null;
  outputCodec: BackgroundRemovalOutputCodec;
}) {
  const { data, error, isLoading } = useSWR(
    '/api/billing-products?productKey=background-removal-video-v3',
    async (url: string) => {
      const response = await authFetch(url);
      const payload = (await response.json().catch(() => null)) as BillingProductResponse | null;
      if (!response.ok || !payload?.ok || !payload.product) {
        throw new Error(payload?.error ?? params.copy.priceUnavailable);
      }
      return payload.product;
    },
    { keepPreviousData: true }
  );

  const preview = useMemo(
    () =>
      buildBackgroundRemovalPricingPreview({
        unitPriceCents: data?.unitPriceCents ?? null,
        currency: data?.currency ?? 'USD',
        durationSec: params.metadata?.durationSec ?? null,
        outputCodec: params.outputCodec,
      }),
    [data?.currency, data?.unitPriceCents, params.metadata?.durationSec, params.outputCodec]
  );

  const priceLabel = formatCurrency(preview.totalCents, preview.currency, params.locale);
  const priceHint = isLoading
    ? params.copy.priceLoading
    : error
      ? params.copy.priceUnavailable
      : !preview.ready
        ? params.copy.metadataRequired
        : params.copy.priceReady;

  return {
    priceHint,
    priceLabel,
    pricePreview: preview,
  };
}
