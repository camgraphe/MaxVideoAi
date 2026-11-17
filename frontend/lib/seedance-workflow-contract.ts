import type { AspectRatio } from '@/types/engines';
export const SEEDANCE_WORKFLOW_ASPECT_RATIOS: readonly AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
export const SEEDANCE_FINAL_RESOLUTIONS = ['1080p', '4k'] as const;
export type SeedanceFinalResolution = typeof SEEDANCE_FINAL_RESOLUTIONS[number];
export function isSeedanceFinalResolution(value: unknown): value is SeedanceFinalResolution {
  return value === '1080p' || value === '4k';
}
export type SeedanceWorkflowJob = {
  jobId: string; status: string; amountCents: number | null; currency: string;
  paymentStatus: string | null; videoUrl: string | null; thumbUrl: string | null;
  message?: string | null;
  resolution?: SeedanceFinalResolution;
};
export type SeedanceWorkflowView = {
  draft: SeedanceWorkflowJob; final: SeedanceWorkflowJob | null; expiresAt: string | null;
  eligibility: 'pending' | 'ready' | 'expired' | 'finalizing' | 'finalized' | 'failed' | 'unavailable';
  settings: { durationSec: number; durationOption?: number | string | null; mode?: 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend';
    aspectRatio: AspectRatio | null; audio: boolean; resolution: '480p' };
};
export type SeedanceDraftControls = {
  available: boolean; selected: boolean; phase: 'setup' | 'draft' | 'confirm' | 'final';
  toggle: () => void; generate: () => void; live?: boolean; pending?: boolean;
};
