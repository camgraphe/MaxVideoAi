import type { PricingSnapshot } from '@/types/engines';
import type { BillingProductKey, JobSurface } from '@/types/billing';

export interface Job {
  jobId: string;
  surface?: JobSurface;
  billingProductKey?: BillingProductKey | null;
  settingsSnapshot?: unknown;
  engineLabel: string;
  durationSec: number;
  prompt: string;
  thumbUrl?: string | null;
  videoUrl?: string;
  audioUrl?: string | null;
  readyVideoUrl?: string | null;
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
  renderThumbUrls?: string[] | null;
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
