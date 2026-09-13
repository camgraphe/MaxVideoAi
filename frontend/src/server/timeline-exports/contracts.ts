import type { WorkspaceTimelineExportQualityPreset } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';

export type TimelineExportStatus = 'queued' | 'rendering' | 'completed' | 'failed' | 'canceled';

export type TimelineExportArtifact = {
  outputUrl: string;
  outputAssetId: string | null;
  sizeBytes: number | null;
  mimeType: string | null;
};

export type TimelineExportJobStatus = {
  id: string;
  status: TimelineExportStatus;
  progress: number;
  message: string | null;
};

export type TimelineExportJobResponse = TimelineExportJobStatus & {
  artifact: TimelineExportArtifact | null;
};

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
