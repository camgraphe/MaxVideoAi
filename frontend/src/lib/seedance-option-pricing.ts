import type { AspectRatio } from '@/types/engines';
import type { PricingContext } from '@/lib/pricing-context';
import { seedanceOutputDimensions } from '@/lib/seedance-output-dimensions';

export const SEEDANCE_REVIEWED_PRICING_ASPECTS: readonly AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];

export function seedanceAutomaticDurationBounds(engineId: string): { min: 4; max: 15 | 30 } | null {
  if (engineId === 'seedance-2-5') return { min: 4, max: 30 };
  return ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini'].includes(engineId) ? { min: 4, max: 15 } : null;
}

export function isSeedanceAdaptiveAspect(aspectRatio?: string | null): boolean {
  return aspectRatio === 'auto' || aspectRatio === 'adaptive';
}

/** Arbitrary inherited framing has no reviewed tariff; allow published raster rounding only. */
export function resolveSeedanceSourcePricingAspectRatio(source: { width?: number | null; height?: number | null }): AspectRatio {
  const { width, height } = source;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width! <= 0 || height! <= 0) {
    throw new Error('Verified source dimensions are required for adaptive pricing.');
  }
  const ratio = width! / height!;
  // Published raster rounding can exceed nominal 1%; admit those exact pairs
  // from the same pure owner used by supplier accounting, never arbitrary nearby sizes.
  for (const engineId of ['seedance-2-5', 'seedance-2-0']) {
    for (const resolution of ['480p', '720p', '1080p', '4k']) {
      const exact = SEEDANCE_REVIEWED_PRICING_ASPECTS.find(aspect => {
        const raster = seedanceOutputDimensions(engineId, resolution, aspect);
        return raster?.width === width && raster?.height === height;
      });
      if (exact) return exact;
    }
  }
  const selected = SEEDANCE_REVIEWED_PRICING_ASPECTS.find(aspect => {
    const [x, y] = aspect.split(':').map(Number);
    return Math.abs(ratio / (x! / y!) - 1) <= 0.01;
  });
  if (!selected) throw new Error('A reviewed customer tariff for this source format is unavailable.');
  return selected;
}

/** Only server-resolved source dimensions may populate the internal pricing class. */
export function seedanceSourcePricingAspectRatio(context: Pick<PricingContext, 'mode' | 'aspectRatio'> & { engine: { id: string } },
  references: readonly { kind: string; fieldId?: string; width?: number | null; height?: number | null }[]): AspectRatio | undefined {
  const inheritsSource = context.engine.id === 'seedance-2-5' && ['i2v', 'extend'].includes(context.mode ?? '');
  if (!seedanceAutomaticDurationBounds(context.engine.id) || (!isSeedanceAdaptiveAspect(context.aspectRatio) && !inheritsSource)
    || !['i2v', 'v2v', 'extend'].includes(context.mode ?? '')) return undefined;
  const primaryField = context.mode === 'i2v' ? 'image_url' : context.mode === 'v2v' ? 'video_url' : 'extension_source_videos';
  const sources = references.filter(reference => reference.kind === (context.mode === 'i2v' ? 'image' : 'video')
    && (!reference.fieldId || reference.fieldId === primaryField));
  if (!sources.length) throw new Error('Verified source dimensions are required for adaptive pricing.');
  const aspects = new Set(sources.map(resolveSeedanceSourcePricingAspectRatio));
  if (aspects.size !== 1) throw new Error('Adaptive source framing requires one reviewed source format.');
  return [...aspects][0];
}

/** Provider Auto (-1) stays outside pricing; the disclosed fixed maximum is a positive tariff class. */
export function normalizeSeedancePricingContext(context: PricingContext): PricingContext {
  const bounds = seedanceAutomaticDurationBounds(context.engine.id);
  if (!bounds) return context;
  const durationSec = context.seedanceEditSource?.billedDurationSec
    ?? (context.durationOption === 'auto' ? bounds.max : context.durationSec);
  let aspectRatio = context.seedanceEditSource?.pricingAspectRatio ?? context.seedanceSourceAspectRatio ?? context.aspectRatio;
  if (isSeedanceAdaptiveAspect(aspectRatio) && ['i2v', 'v2v', 'extend'].includes(context.mode ?? '')) {
    if (!context.seedanceSourceAspectRatio || !SEEDANCE_REVIEWED_PRICING_ASPECTS.includes(context.seedanceSourceAspectRatio)) {
      throw new Error('Verified source framing is required for adaptive pricing.');
    }
    aspectRatio = context.seedanceSourceAspectRatio;
  }
  return durationSec === context.durationSec && aspectRatio === context.aspectRatio ? context : { ...context, durationSec, aspectRatio };
}

export function seedanceAutomaticPricingMetadata(requested: PricingContext, priced: PricingContext,
  aspectPolicy?: 'highest_current_tariff' | 'verified_source') {
  const bounds = seedanceAutomaticDurationBounds(requested.engine.id);
  if (!bounds || requested.seedanceEditSource
    || (requested.durationOption !== 'auto' && !isSeedanceAdaptiveAspect(requested.aspectRatio))) return undefined;
  return { ...(requested.durationOption === 'auto' ? { durationRange: bounds } : {}), billedDurationSec: priced.durationSec,
    ...(isSeedanceAdaptiveAspect(requested.aspectRatio) ? { requestedAspectRatio: 'auto', pricingAspectRatio: priced.aspectRatio,
      aspectPolicy: aspectPolicy ?? 'verified_source' } : {}), fixedPrice: true };
}
