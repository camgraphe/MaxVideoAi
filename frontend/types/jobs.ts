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
  finalPriceCents?: number;
  currency?: string;
  pricingSnapshot?: PricingSnapshot;
  vendorAccountId?: string;
  paymentStatus?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
}

export interface JobsPage {
  ok: boolean;
  jobs: Job[];
  nextCursor: string | null;
}
