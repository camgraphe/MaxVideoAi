/** Remove binary subtraction noise without changing the chosen start/end points. */
export function mediaExcerptDuration(range: { startSec: number; endSec: number }): number {
  const length = range.endSec - range.startSec;
  const rounded = Number(length.toFixed(9));
  const noise = Number.EPSILON * (Math.abs(range.startSec) + Math.abs(range.endSec)) * 2;
  // A frame-derived minimum such as 56/24 must retain its full precision.
  return Math.abs(length - rounded) <= noise ? rounded : length;
}

// Operational budgets apply only to excerpt preparation, never model generation.
export const VIDEO_EXCERPT_PREPARATION_LIMITS = Object.freeze({ maxBytes: 100 * 1024 * 1024, maxSourceSec: 180, maxExcerptSec: 60, maxPixels: 16_777_216, maxFps: 120 });

export type VideoExcerptRange = { startSec: number; endSec: number };
export type VideoExcerptLimits = Readonly<{
  sourceFieldId: string;
  minDurationSec: number | null;
  maxDurationSec: number | null;
  maxSizeMB: number | null;
  durationPolicy: 'requested' | 'source_video' | 'source_audio';
}>;
