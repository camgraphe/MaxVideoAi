import type { AspectRatio } from '@/types/engines';
export const SEEDANCE_WORKFLOW_ASPECT_RATIOS: readonly AspectRatio[] = ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
export type SeedanceWorkflowJob = {
  jobId: string; status: string; amountCents: number | null; currency: string;
  paymentStatus: string | null; videoUrl: string | null; thumbUrl: string | null;
  message?: string | null;
};
export type SeedanceWorkflowView = {
  draft: SeedanceWorkflowJob; final: SeedanceWorkflowJob | null; expiresAt: string | null;
  eligibility: 'pending' | 'ready' | 'expired' | 'finalizing' | 'finalized' | 'failed' | 'unavailable';
  settings: { durationSec: number; aspectRatio: AspectRatio; audio: boolean; resolution: '480p' };
};
export type SeedanceDraftControls = {
  available: boolean; selected: boolean; phase: 'setup' | 'draft' | 'confirm' | 'final';
  toggle: () => void; generate: () => void; live?: boolean; pending?: boolean;
};
