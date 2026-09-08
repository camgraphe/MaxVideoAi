import type { UpscaleMediaType, UpscaleMode, UpscaleTargetResolution, UpscaleToolEngineDefinition } from '@/types/tools-upscale';
import { toolboxCopy } from '../../toolbox-copy';
import { useToolQuote } from '../../useToolQuote';
import type { UploadedAsset } from '../_lib/upscale-workspace-types';

export function useUpscalePricingPreview(params: {
  copy: { priceLoading: string; priceReady: string; priceUnavailable: string; priceVideoMissing: string };
  engine: UpscaleToolEngineDefinition; locale: string; mediaType: UpscaleMediaType; mediaUrl: string;
  mode: UpscaleMode; source: UploadedAsset | null; targetResolution: UpscaleTargetResolution; upscaleFactor: number;
  outputFormat: string; userId?: string | null;
}) {
  const quote = useToolQuote(params.mediaUrl.trim() ? { toolId: 'upscale', mediaType: params.mediaType, mediaUrl: params.mediaUrl.trim(), engineId: params.engine.id, mode: params.mode, upscaleFactor: params.upscaleFactor, targetResolution: params.targetResolution, outputFormat: params.outputFormat, imageWidth: params.source?.width ?? null, imageHeight: params.source?.height ?? null } : null, params.userId);
  return {
    priceLabel: quote.quote ? new Intl.NumberFormat(params.locale, { style: 'currency', currency: quote.quote.currency }).format(quote.quote.totalCents / 100) : '—',
    priceHint: quote.error ? params.copy.priceUnavailable : quote.loading ? params.copy.priceLoading : quote.ready ? params.copy.priceReady : toolboxCopy(params.locale).emptyHint,
    pricePreview: { ready: quote.ready, totalCents: quote.quote?.totalCents ?? null, currency: quote.quote?.currency ?? 'USD' },
    acceptedQuote: quote.quote,
    quoteError: quote.error,
    priceLoading: quote.loading,
    refreshQuote: quote.refresh,
  };
}
