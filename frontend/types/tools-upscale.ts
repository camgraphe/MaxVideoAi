export type UpscaleMediaType = 'image' | 'video';

export type UpscaleToolEngineId =
  | 'seedvr-image'
  | 'topaz-image'
  | 'recraft-crisp'
  | 'seedvr-video'
  | 'flashvsr-video'
  | 'topaz-video';

export type UpscaleMode = 'factor' | 'target';

export type UpscaleTargetResolution = '720p' | '1080p' | '1440p' | '2160p';

export type UpscaleOutputFormat = 'jpg' | 'png' | 'webp' | 'mp4' | 'webm' | 'mov' | 'gif';

export interface UpscaleToolRequest {
  mediaType: UpscaleMediaType;
  mediaUrl: string;
  engineId?: UpscaleToolEngineId;
  mode?: UpscaleMode;
  upscaleFactor?: number;
  targetResolution?: UpscaleTargetResolution;
  outputFormat?: UpscaleOutputFormat;
  sourceJobId?: string | null;
  sourceAssetId?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
}

export interface UpscaleToolOutput {
  url: string;
  thumbUrl?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  originUrl?: string | null;
  assetId?: string | null;
  source?: string | null;
  persisted?: boolean;
}

export interface UpscaleToolPricing {
  estimatedCostUsd: number;
  actualCostUsd?: number | null;
  currency?: string;
  estimatedCredits: number;
  actualCredits?: number | null;
  totalCents?: number | null;
  billingProductKey?: string | null;
  estimate?: {
    megapixels?: number | null;
    frames?: number | null;
    durationSec?: number | null;
  };
}

export interface UpscaleToolResponse {
  ok: boolean;
  jobId?: string | null;
  engineId: UpscaleToolEngineId;
  engineLabel: string;
  mediaType: UpscaleMediaType;
  requestId?: string | null;
  providerJobId?: string | null;
  latencyMs: number;
  pricing: UpscaleToolPricing;
  output?: UpscaleToolOutput | null;
  error?: {
    code: string;
    message: string;
    detail?: unknown;
  };
}

export interface UpscaleToolEngineDefinition {
  id: UpscaleToolEngineId;
  label: string;
  description: string;
  mediaType: UpscaleMediaType;
  falModelId: string;
  billingProductKey: string;
  defaultMode: UpscaleMode;
  supportedModes: UpscaleMode[];
  defaultUpscaleFactor: number;
  supportedUpscaleFactors: number[];
  defaultTargetResolution?: UpscaleTargetResolution;
  supportedTargetResolutions?: UpscaleTargetResolution[];
  defaultOutputFormat: UpscaleOutputFormat;
  supportedOutputFormats: UpscaleOutputFormat[];
  providerPriceUsd: {
    perImage?: number;
    perMegapixel?: number;
    perVideoMegapixelFrame?: number;
    perSecondByResolution?: Partial<Record<UpscaleTargetResolution, number>>;
  };
  premium?: boolean;
}
