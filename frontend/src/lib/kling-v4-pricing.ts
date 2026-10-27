import type { PricingContext } from './pricing-context';

/** Public fal LIST evidence, 2026-10-25. These are supplier facts, never customer tariffs. */
export const KLING_V4_PRICING_SOURCE = 'https://fal.ai/models/kling/v4';
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
  const centsPerSecond = (hasVideo ? {'720p':9.4,'1080p':14.1} : {'720p':15.7,'1080p':23.5})[context.resolution as '720p'|'1080p'];
  if (!centsPerSecond) throw new Error('Unsupported Kling V4 pricing resolution.');
  const billableSeconds = hasVideo ? Math.max(input + output, 2 * output) : output;
  return {inputVideoDurationSec:input,outputDurationSec:output,hasVideoInput:hasVideo,billableSeconds,centsPerSecond,
    supplierExactCents:Number((billableSeconds*centsPerSecond).toFixed(6))};
}
