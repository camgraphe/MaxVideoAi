import { useToolQuote } from '../../useToolQuote';
import type { BackgroundRemovalWorkspaceCopy } from '../_lib/background-removal-workspace-copy';
import type { BackgroundRemovalVideoMetadata } from '../_lib/background-removal-workspace-types';
import type { BackgroundRemovalOutputCodec, BackgroundRemovalStudioBackgroundColor } from '@/types/tools-background-removal';
export function useBackgroundRemovalPricingPreview(params: { copy: BackgroundRemovalWorkspaceCopy; locale: string; metadata: BackgroundRemovalVideoMetadata | null; outputCodec: BackgroundRemovalOutputCodec; videoUrl: string; backgroundColor: BackgroundRemovalStudioBackgroundColor; preserveAudio: boolean; userId?: string | null }) {
  const quote = useToolQuote(params.metadata && params.videoUrl.trim() ? { toolId: 'background-removal', videoUrl: params.videoUrl.trim(), outputContainerAndCodec: params.outputCodec, backgroundColor: params.backgroundColor, preserveAudio: params.preserveAudio, videoWidth: params.metadata.width, videoHeight: params.metadata.height, durationSec: params.metadata.durationSec, fps: params.metadata.fps } : null, params.userId);
  return {
    priceLabel: quote.quote ? new Intl.NumberFormat(params.locale, { style: 'currency', currency: quote.quote.currency }).format(quote.quote.totalCents / 100) : '—',
    priceHint: quote.error ? params.copy.priceUnavailable : quote.loading ? params.copy.priceLoading : quote.ready ? params.copy.priceReady : params.copy.metadataRequired,
    pricePreview: { ready: quote.ready, totalCents: quote.quote?.totalCents ?? null, currency: quote.quote?.currency ?? 'USD' },
    acceptedQuote: quote.quote,
    quoteError: quote.error,
    priceLoading: quote.loading,
    refreshQuote: quote.refresh,
  };
}
