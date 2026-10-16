import type { PricingContext } from './pricing-context';

/** Separate commercial dimensions within Seedance 2.5, never a new model. */
export function assertSeedanceWorkflowPricing(context: PricingContext): void {
  if (context.workflowStep === undefined) return;
  if (!['draft', 'final'].includes(context.workflowStep) || context.engine.id !== 'seedance-2-5'
    || !['t2v', 'i2v', 'ref2v', 'v2v', 'extend'].includes(context.mode ?? '')
    || context.resolution !== (context.workflowStep === 'draft' ? '480p' : '1080p')
    || !Number.isInteger(context.durationSec) || context.durationSec < 4 || context.durationSec > 30
    || (context.mode === 't2v' && (context.hasVideoInput || context.referenceImageCount || context.inputImageCount
      || context.inputVideoDurationSec || context.inputAudioDurationSec))
    || (context.mode === 'i2v' && (context.hasVideoInput || context.inputVideoDurationSec))
    || (['v2v', 'extend'].includes(context.mode ?? '') && context.hasVideoInput !== true)
    || (context.hasVideoInput && (typeof context.inputVideoDurationSec !== 'number' || !Number.isFinite(context.inputVideoDurationSec)
      || context.inputVideoDurationSec <= 0 || context.inputVideoDurationSec > 30))
    || [context.referenceImageCount, context.inputImageCount].some(count => count !== undefined
      && (!Number.isSafeInteger(count) || count < 0 || count > 30))) {
    throw new Error('Unsupported Seedance Draft workflow pricing settings.');
  }
}
