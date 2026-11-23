import type { PricingContext } from './pricing-context';
import type { KLING_V4_RESOLUTIONS } from '@/config/fal-engines/kling-v4';

/** Fal's published SDR LIST rates, including the 2026-11-19 native 4K release. */
export const KLING_V4_PRICING_SOURCE = 'https://fal.ai/models/kling/v4';
export const KLING_V4_4K_PRICING_CHECKED_AT = '2026-11-20';
type KlingV4Resolution = (typeof KLING_V4_RESOLUTIONS)[number];
const outputOnlyCentsPerSecond = { '720p': 15.7, '1080p': 23.5, '4k': 54.9 } satisfies Record<KlingV4Resolution, number>;
const withVideoCentsPerSecond = { '720p': 9.4, '1080p': 14.1, '4k': 32.9 } satisfies Record<KlingV4Resolution, number>;

export function klingV4PricingUsage(context: Pick<PricingContext, 'mode'|'resolution'|'durationSec'|'hasVideoInput'|'inputVideoDurationSec'|'inheritedDurationSec'>) {
  const mode = context.mode ?? 't2v';
  if (!['t2v','i2v','ref2v','v2v'].includes(mode)) throw new Error('Unsupported Kling V4 pricing mode.');
  const hasVideo = mode === 'v2v' || context.hasVideoInput === true;
  if ((mode === 't2v' || mode === 'i2v') && hasVideo) throw new Error('Unexpected Kling V4 video input.');
  if (mode === 'ref2v' && context.hasVideoInput === undefined) throw new Error('Verified Kling V4 input class is required.');
  const input = context.inputVideoDurationSec ?? 0;
  if (!Number.isFinite(input) || (hasVideo ? input < 3 || input > (mode === 'v2v' ? 30.05 : 30) : input !== 0)) {
    throw new Error('Verified Kling V4 video seconds are required.');
  }
  const inherited = context.inheritedDurationSec;
  const output = inherited ?? context.durationSec;
  if (!Number.isFinite(output) || output < 3 || output > (inherited === undefined ? 30 : 30.05)
    || (inherited === undefined && !Number.isInteger(output))
    || (inherited !== undefined && (mode !== 'v2v' || inherited !== input))) throw new Error('Unsupported Kling V4 output duration.');
  const rates = hasVideo ? withVideoCentsPerSecond : outputOnlyCentsPerSecond;
  if (!context.resolution || !Object.hasOwn(rates, context.resolution)) throw new Error('Unsupported Kling V4 pricing resolution.');
  const centsPerSecond = rates[context.resolution as KlingV4Resolution];
  const billableSeconds = hasVideo ? Math.max(input + output, 2 * output) : output;
  return {inputVideoDurationSec:input,outputDurationSec:output,hasVideoInput:hasVideo,billableSeconds,centsPerSecond,
    supplierExactCents:Number((billableSeconds*centsPerSecond).toFixed(6))};
}
