import type { PricingContext } from './pricing-context';
export const KLING_V4_FLASH_PRICING_SOURCE = 'https://fal.ai/models/kling/v4/flash/reference-to-video';

/** fal list rates verified 2026-11-05. Retail amounts require reviewed tariff cells. */
export function klingV4FlashPricingUsage(context: Pick<PricingContext, 'mode' | 'resolution' | 'durationSec' | 'hasVideoInput' | 'inputVideoDurationSec' | 'inheritedDurationSec'>) {
  const mode = context.mode ?? 't2v', output = context.durationSec;
  if (!['t2v', 'i2v', 'ref2v'].includes(mode) || context.resolution !== '720p' || context.inheritedDurationSec !== undefined
    || !Number.isInteger(output) || output < 3 || output > 20) throw new Error('Unsupported Kling Flash pricing scenario.');
  if (mode === 'ref2v' && context.hasVideoInput === undefined) throw new Error('Verified Kling Flash input class is required.');
  const hasVideoInput = context.hasVideoInput === true;
  if (mode !== 'ref2v' && hasVideoInput) throw new Error('Kling Flash video references require reference mode.');
  const inputVideoDurationSec = context.inputVideoDurationSec ?? 0;
  if (!Number.isFinite(inputVideoDurationSec) || (hasVideoInput ? inputVideoDurationSec < 3 || inputVideoDurationSec > 20 : inputVideoDurationSec !== 0)) throw new Error('Exact owned Kling Flash video timing is required.');
  const centsPerSecond = hasVideoInput ? 6.3 : 9.4;
  const billableSeconds = hasVideoInput ? output + Math.max(inputVideoDurationSec, output) : output;
  return { inputVideoDurationSec, outputDurationSec: output, hasVideoInput, billableSeconds, centsPerSecond,
    supplierExactCents: Number((billableSeconds * centsPerSecond).toFixed(10)) };
}
