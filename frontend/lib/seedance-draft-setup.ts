import { SEEDANCE_WORKFLOW_ASPECT_RATIOS } from './seedance-workflow-contract';
import type { AspectRatio } from '@/types/engines';

export type SeedanceFinalResolution = '1080p' | '4k';
export type SeedanceDraftEligibility = 'pending' | 'ready' | 'expired' | 'finalizing' | 'finalized' | 'failed' | 'unavailable';

/** Scenario compatibility only. Server activation and account checks remain separate. */
export function supportsSeedanceDraftSetup(setup: {
  engineId?: string; mode: string; iterations?: number; aspectRatio?: string;
}): boolean {
  const ratio = setup.aspectRatio === 'auto' || SEEDANCE_WORKFLOW_ASPECT_RATIOS.includes(setup.aspectRatio as AspectRatio);
  return setup.engineId === 'seedance-2-5' && setup.iterations === 1
    && ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'].includes(setup.mode)
    && (ratio || setup.mode === 'i2v' || setup.mode === 'v2v');
}
