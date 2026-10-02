import type { PricingContext } from './pricing-context';

/** Separate commercial dimensions within Seedance 2.5, never a new model. */
export function assertSeedanceWorkflowPricing(context: PricingContext): void {
  if (context.workflowStep === undefined) return;
  if (!['draft', 'final'].includes(context.workflowStep) || context.engine.id !== 'seedance-2-5'
    || context.mode !== 't2v' || context.resolution !== (context.workflowStep === 'draft' ? '480p' : '1080p')
    || !Number.isInteger(context.durationSec) || context.durationSec < 4 || context.durationSec > 30
    || context.hasVideoInput || context.referenceImageCount || context.inputImageCount
    || context.inputVideoDurationSec || context.inputAudioDurationSec) {
    throw new Error('Unsupported Seedance Draft workflow pricing settings.');
  }
}
