import type { PricingContext } from './pricing-context';
export const KLING_V4_FLASH_PRICING_SOURCE = 'https://fal.ai/models/kling/v4/flash/reference-to-video';
export const KLING_V4_FLASH_MODIFY_PRICING_SOURCE = 'https://fal.ai/models/kling/v4/flash/video-to-video/api';

/** fal creation LIST rates verified 2026-11-05; Modify 2026-11-07. Retail requires reviewed cells. */
export function klingV4FlashPricingUsage(context: Pick<PricingContext, 'mode' | 'resolution' | 'durationSec' | 'hasVideoInput' | 'inputVideoDurationSec' | 'inheritedDurationSec'>) {
  const mode = context.mode ?? 't2v';
  const inherited = context.inheritedDurationSec;
  const output = inherited ?? context.durationSec;
  if (!['t2v', 'i2v', 'ref2v', 'v2v'].includes(mode) || context.resolution !== '720p'
    || !Number.isFinite(output) || output < 3 || output > 20
    || (inherited === undefined ? !Number.isInteger(output) : mode !== 'v2v')) {
    throw new Error('Unsupported Kling Flash pricing scenario.');
  }
  if (mode === 'ref2v' && context.hasVideoInput === undefined) throw new Error('Verified Kling Flash input class is required.');
  if (mode === 'v2v' && context.hasVideoInput !== true) throw new Error('Verified Kling Flash source video is required.');
  const hasVideoInput = context.hasVideoInput === true;
  if (!['ref2v', 'v2v'].includes(mode) && hasVideoInput) throw new Error('Kling Flash video references require reference or Modify mode.');
  const inputVideoDurationSec = context.inputVideoDurationSec ?? 0;
  if (!Number.isFinite(inputVideoDurationSec) || (hasVideoInput ? inputVideoDurationSec < 3 || inputVideoDurationSec > 20 : inputVideoDurationSec !== 0)) throw new Error('Exact owned Kling Flash video timing is required.');
  // Source timing and the sum of source/reference/subject timing are separate facts.
  if (inherited !== undefined && inherited > inputVideoDurationSec) throw new Error('Inherited Kling Flash source timing exceeds aggregate input timing.');
  const centsPerSecond = hasVideoInput ? 6.3 : 9.4;
  const billableSeconds = hasVideoInput ? output + Math.max(inputVideoDurationSec, output) : output;
  return { inputVideoDurationSec, outputDurationSec: output, hasVideoInput, billableSeconds, centsPerSecond,
    supplierExactCents: Number((billableSeconds * centsPerSecond).toFixed(10)) };
}
