import { seedance25OutputDimensions } from '@/lib/seedance-output-dimensions';
export { seedance25OutputDimensions } from '@/lib/seedance-output-dimensions';

/** Duration-only estimate. Actual reported tokens remain authoritative (e.g. 97 vs 96 frames). */
export function estimateSeedance25OutputTokens(input: {
  resolution: string;
  aspectRatio?: string | null;
  durationSec: number;
}) {
  if (!Number.isFinite(input.durationSec) || input.durationSec <= 0) return null;
  const dimensions = seedance25OutputDimensions(input.resolution, input.aspectRatio ?? '16:9');
  if (!dimensions) return null;
  return { ...dimensions, tokenCount: dimensions.width * dimensions.height
    * Math.max(1, Math.round(input.durationSec)) * 24 / 1024 };
}
