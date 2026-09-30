import { UPSCALE_TOOL_ENGINES } from '@/config/tools-upscale-engines';
import { buildUpscalePricingPreview } from '@/lib/tools-upscale';
import { buildBackgroundRemovalPricingPreview } from '@/lib/tools-background-removal';
import { resolveDynamicToolPriceMultiplier } from '@/lib/tools-dynamic-pricing';
import type { BillingProductRecord } from '@/types/billing';

/** Read-only, illustrative scenarios reuse the calculators consumed by real tool execution. */
export function buildDynamicToolProductPreviews(product: BillingProductRecord): Array<{ scenarioId: string; totalCents: number }> {
  const multiplier = resolveDynamicToolPriceMultiplier(product.productKey, product.metadata);
  if (multiplier == null) return [];
  const engine = UPSCALE_TOOL_ENGINES.find(row => row.billingProductKey === product.productKey && row.mediaType === 'video');
  const references = [1, 10, 30, 60].map(durationSec => ({ durationSec,
    resolution: engine?.defaultTargetResolution ?? '1080p' as const }));
  if (engine?.supportedTargetResolutions?.includes('2160p')) references.push({ durationSec: 10, resolution: '2160p' });
  return references.map(({ durationSec, resolution }) => {
    const result = engine ? buildUpscalePricingPreview({ mediaType: 'video', engineId: engine.id,
      unitPriceCents: product.unitPriceCents, currency: product.currency, priceMultiplier: multiplier,
      videoMetadata: { width: 1280, height: 720, durationSec, fps: 30 }, targetResolution: resolution,
      upscaleFactor: engine.defaultUpscaleFactor })
      : buildBackgroundRemovalPricingPreview({ unitPriceCents: product.unitPriceCents, currency: product.currency,
        durationSec, outputCodec: 'webm_vp9', priceMultiplier: multiplier });
    if (!result.ready || !Number.isSafeInteger(result.totalCents)) throw new Error('Dynamic product reference quote unavailable');
    return { scenarioId: `billing-product:${product.productKey}:${durationSec}s:${engine ? `${resolution}:720p-source:30fps` : 'webm-vp9'}`,
      totalCents: result.totalCents! };
  });
}
