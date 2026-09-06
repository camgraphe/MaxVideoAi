import { parseAspectRatio } from '@/lib/aspect';
import type { EngineCaps, Mode } from '@/types/engines';
import { getModeCaps } from './workspace-engine-helpers';

export function resolveDerivedAspectRatio(value: string, engine: EngineCaps, mode: Mode): string {
  const supported = getModeCaps(engine, mode)?.aspectRatio ?? [];
  if (supported.includes(value)) return value;
  const dimensions = parseAspectRatio(value);
  if (!dimensions) return value;
  const ratio = dimensions.width / dimensions.height;
  let closest = value;
  // Output dimensions can be slightly rounded (H3's 2544x1456 is near 16:9).
  // Only recover a nearby supported setting; arbitrary framing keeps the existing fallback.
  let closestDifference = 0.02;
  for (const option of supported) {
    const parts = parseAspectRatio(option);
    if (!parts) continue;
    const expected = parts.width / parts.height;
    const difference = Math.abs(ratio - expected) / expected;
    if (difference < closestDifference) {
      closest = option;
      closestDifference = difference;
    }
  }
  return closest;
}
