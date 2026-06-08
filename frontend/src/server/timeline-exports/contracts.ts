import type { WorkspaceTimelineExportQualityPreset } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-render';

export type TimelineExportStatus = 'queued' | 'rendering' | 'completed' | 'failed' | 'canceled';
export type TimelineExportBillingKind = 'free' | 'paid';
export type TimelineExportBillingStatus =
  | 'free_reserved'
  | 'free_completed'
  | 'free_released'
  | 'paid_reserved'
  | 'paid_completed'
  | 'refunded'
  | 'platform';

export type TimelineExportEstimateInput = {
  durationSec: number;
  resolution: string | null | undefined;
  fps: number | null | undefined;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  freeExportsRemaining: number;
};

export type TimelineExportPriceEstimate = {
  billingKind: TimelineExportBillingKind;
  amountCents: number;
  currency: 'USD';
  freeExportsRemaining: number;
  unitCentsPerSecond: number;
  multiplier: number;
};

export type TimelineExportQuota = {
  freeLimit: number;
  usedFreeExports: number;
  freeExportsRemaining: number;
  billingKind: TimelineExportBillingKind;
};
