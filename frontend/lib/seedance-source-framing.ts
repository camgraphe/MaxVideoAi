import { isSeedance25EngineId } from './seedance-model-variants';
import { seedanceOutputDimensions } from './seedance-output-dimensions';

export const SEEDANCE_REVIEWED_PRICING_ASPECTS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
type SourceAspect = (typeof SEEDANCE_REVIEWED_PRICING_ASPECTS)[number];

export function seedanceAutomaticDurationBounds(engineId: string): { min: 4; max: 15 | 30 } | null {
  if (isSeedance25EngineId(engineId)) return { min: 4, max: 30 };
  return ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini'].includes(engineId) ? { min: 4, max: 15 } : null;
}

export function isSeedanceAdaptiveAspect(aspectRatio?: string | null): boolean {
  return aspectRatio === 'auto' || aspectRatio === 'adaptive';
}

/** Arbitrary inherited framing has no reviewed tariff; allow published raster rounding only. */
export function resolveSeedanceSourcePricingAspectRatio(source: { width?: number | null; height?: number | null }): SourceAspect {
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

/** Generation uses verified owned dimensions. Public previews can classify the declared raster separately. */
export function seedanceSourcePricingAspectRatio(context: { mode?: string; aspectRatio?: string | null; engine: { id: string } },
  references: readonly { kind: string; fieldId?: string; width?: number | null; height?: number | null }[]): SourceAspect | undefined {
  const inheritsSource = isSeedance25EngineId(context.engine.id) && ['i2v', 'extend'].includes(context.mode ?? '');
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

/** Provider timing stays exact. Only the existing literal output tariff class rounds up. */
export function resolveSeedanceEditSourceFacts(source: {
  durationSec?: number | null; width?: number | null; height?: number | null;
}) {
  const { durationSec, width, height } = source;
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec < 4 || durationSec > 30) {
    throw new Error('ModelArk Edit requires a verified source duration from 4 to 30 seconds.');
  }
  if (typeof width !== 'number' || !Number.isSafeInteger(width) || width <= 0
    || typeof height !== 'number' || !Number.isSafeInteger(height) || height <= 0) {
    throw new Error('Verified source dimensions are required for Edit pricing.');
  }
  const ratio = width / height;
  const pricingAspectRatio = SEEDANCE_REVIEWED_PRICING_ASPECTS.find(value => {
    const [x, y] = value.split(':').map(Number);
    // Published rasters (854x480, 752x560, etc.) slightly round the nominal framing.
    return Math.abs(ratio / (x! / y!) - 1) <= 0.01;
  });
  if (!pricingAspectRatio) throw new Error('A reviewed customer tariff for this source format is unavailable.');
  return { durationSec, width, height, billedDurationSec: Math.ceil(durationSec), pricingAspectRatio,
    outputDuration: 'source', outputAspectRatio: 'source' } as const;
}
