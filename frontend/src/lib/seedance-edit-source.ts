import type { AspectRatio } from '@/types/engines';

export type SeedanceEditSourceFacts = Readonly<{
  durationSec: number; width: number; height: number; billedDurationSec: number;
  pricingAspectRatio: AspectRatio; outputDuration: 'source'; outputAspectRatio: 'source';
}>;
const REVIEWED_SOURCE_RATIOS = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;

/** Provider timing stays exact. Only the existing literal output tariff class rounds up. */
export function resolveSeedanceEditSourceFacts(source: {
  durationSec?: number | null; width?: number | null; height?: number | null;
}): SeedanceEditSourceFacts {
  const { durationSec, width, height } = source;
  if (typeof durationSec !== 'number' || !Number.isFinite(durationSec) || durationSec < 4 || durationSec > 30) {
    throw new Error('ModelArk Edit requires a verified source duration from 4 to 30 seconds.');
  }
  if (typeof width !== 'number' || !Number.isSafeInteger(width) || width <= 0
    || typeof height !== 'number' || !Number.isSafeInteger(height) || height <= 0) {
    throw new Error('Verified source dimensions are required for Edit pricing.');
  }
  const ratio = width / height;
  const pricingAspectRatio = REVIEWED_SOURCE_RATIOS.find(value => {
    const [x, y] = value.split(':').map(Number);
    // Published rasters (854x480, 752x560, etc.) slightly round the nominal framing.
    return Math.abs(ratio / (x! / y!) - 1) <= 0.01;
  });
  if (!pricingAspectRatio) throw new Error('A reviewed customer tariff for this source format is unavailable.');
  return { durationSec, width, height, billedDurationSec: Math.ceil(durationSec), pricingAspectRatio,
    outputDuration: 'source', outputAspectRatio: 'source' };
}
