export type BackgroundRemovalEngineId = 'bria-video-background-removal-v3';

export type BackgroundRemovalStudioBackgroundColor =
  | 'Transparent'
  | 'Black'
  | 'White'
  | 'Gray'
  | 'Red'
  | 'Green'
  | 'Blue'
  | 'Yellow'
  | 'Cyan'
  | 'Magenta'
  | 'Orange';

export type BackgroundRemovalOutputCodec =
  | 'mp4_h265'
  | 'mp4_h264'
  | 'webm_vp9'
  | 'mov_h265'
  | 'mov_proresks'
  | 'mkv_h265'
  | 'mkv_h264'
  | 'mkv_vp9'
  | 'avi_h264'
  | 'gif';

export interface BackgroundRemovalToolRequest {
  videoUrl: string;
  engineId?: 'bria-video-background-removal-v3';
  backgroundColor?: BackgroundRemovalStudioBackgroundColor;
  outputContainerAndCodec?: BackgroundRemovalOutputCodec;
  preserveAudio?: boolean;
  sourceJobId?: string | null;
  sourceAssetId?: string | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  durationSec?: number | null;
  fps?: number | null;
}

export interface BackgroundRemovalToolOutput {
  url: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  mimeType?: string | null;
  originUrl?: string | null;
  assetId?: string | null;
  source?: 'background-removal' | null;
  persisted?: boolean;
}

export interface BackgroundRemovalToolPricing {
  estimatedCostUsd: number;
  actualCostUsd?: number | null;
  currency?: string;
  estimatedCredits: number;
  actualCredits?: number | null;
  totalCents?: number | null;
  billingProductKey?: string | null;
  estimate?: {
    durationSec?: number | null;
    providerEstimateUsd?: number | null;
  };
}

export interface BackgroundRemovalToolResponse {
  ok: boolean;
  jobId?: string | null;
  engineId: 'bria-video-background-removal-v3';
  engineLabel: string;
  requestId?: string | null;
  providerJobId?: string | null;
  latencyMs: number;
  pricing: BackgroundRemovalToolPricing;
  output?: BackgroundRemovalToolOutput | null;
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
}

export interface BackgroundRemovalToolEngineDefinition {
  id: BackgroundRemovalEngineId;
  label: string;
  description: string;
  falModelId: string;
  billingProductKey: string;
  providerPriceUsdPerSecond: number;
}
