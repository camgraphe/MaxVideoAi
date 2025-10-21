import type { PricingSnapshot } from '@/types/engines';

export interface Job {
  jobId: string;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  thumbUrl?: string | null;
  videoUrl?: string;
  createdAt: string;
  engineId?: string;
  aspectRatio?: string;
  hasAudio?: boolean;
  canUpscale?: boolean;
  previewFrame?: string;
  batchId?: string | null;
  groupId?: string | null;
  iterationIndex?: number | null;
  iterationCount?: number | null;
  splitMode?: string | null;
  renderIds?: string[] | null;
  heroRenderId?: string | null;
  localKey?: string | null;
  status?: string;
  progress?: number;
  message?: string | null;
  etaSeconds?: number | null;
  etaLabel?: string | null;
  finalPriceCents?: number;
  currency?: string;
  pricingSnapshot?: PricingSnapshot;
  vendorAccountId?: string;
  paymentStatus?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  visibility?: 'public' | 'private';
  indexable?: boolean;
  curated?: boolean;
}

export interface JobsPage {
  ok: boolean;
  jobs: Job[];
  nextCursor: string | null;
}
