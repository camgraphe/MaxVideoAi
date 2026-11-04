/** Remove binary subtraction noise without changing the chosen start/end points. */
export function mediaExcerptDuration(range: { startSec: number; endSec: number }): number {
  const length = range.endSec - range.startSec;
  const rounded = Number(length.toFixed(9));
  const noise = Number.EPSILON * (Math.abs(range.startSec) + Math.abs(range.endSec)) * 2;
  // A frame-derived minimum such as 56/24 must retain its full precision.
  return Math.abs(length - rounded) <= noise ? rounded : length;
}
