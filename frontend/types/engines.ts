import type { PricingSnapshot } from '@maxvideoai/pricing';
export type { PricingSnapshot } from '@maxvideoai/pricing';

export type EngineStatus = 'live' | 'busy' | 'degraded' | 'maintenance' | 'early_access';
export type LatencyTier = 'fast' | 'standard';
export type Mode = 't2v' | 'i2v' | 'r2v' | 't2i' | 'i2i';
export type Resolution =
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '4k'
  | '1k'
  | '2k'
  | '512P'
  | '768P'
  | 'square_hd'
  | 'landscape_hd'
  | 'portrait_hd'
  | 'auto';
export type AspectRatio =
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:5'
  | '5:4'
  | '4:3'
  | '3:4'
  | '3:2'
  | '2:3'
  | '21:9'
  | 'custom'
  | 'source'
  | 'auto';
export type EngineAvailability = 'available' | 'limited' | 'waitlist' | 'paused';

export interface BrandAssetPolicy {
  logoAllowed: boolean;
  textOnly: boolean;
  linkToGuidelines?: string;
  usageNotes?: string;
}

export interface EngineParam {
  min: number;
  max: number;
  default: number;
  step?: number;
}

export interface EnginePricing {
  unit: string;
  base?: number;
  byResolution?: Record<string, number>;
  examples?: Record<string, number>;
  notes?: string;
  currency?: string;
  addons?: Record<string, { perSecond?: number; flat?: number }>;
}

export interface EngineInputLimits {
  imageMaxMB?: number;
  videoMaxMB?: number;
  videoMaxDurationSec?: number;
  videoCodecs?: string[];
}

export type EngineInputFieldType = 'text' | 'number' | 'enum' | 'image' | 'video';

export interface EngineInputField {
  id: string;
  type: EngineInputFieldType;
  label: string;
  description?: string;
  modes?: Mode[];
  requiredInModes?: Mode[];
  maxCount?: number;
  minCount?: number;
  min?: number;
  max?: number;
  step?: number;
  default?: number | string;
  values?: string[];
  source?: 'upload' | 'url' | 'either';
  engineParam?: string;
}

export interface EngineInputSchema {
  required?: EngineInputField[];
  optional?: EngineInputField[];
  constraints?: {
    supportedFormats?: string[];
    maxImageSizeMB?: number;
    maxVideoSizeMB?: number;
    [key: string]: unknown;
  };
}

export interface EngineCaps {
  id: string;
  label: string;
  provider: string;
  version?: string;
  variant?: string;
  // Hidden behind Labs toggle when true
  isLab?: boolean;
  status: EngineStatus;
  latencyTier: LatencyTier;
  queueDepth?: number;
  region?: string;
  vendorAccountId?: string;
  modes: Mode[];
  maxDurationSec: number;
  resolutions: Resolution[];
  aspectRatios: AspectRatio[];
  fps: number[];
  audio: boolean;
  upscale4k: boolean;
  extend: boolean;
  motionControls: boolean;
  keyframes: boolean;
  params: Record<string, EngineParam>;
  inputLimits: EngineInputLimits;
  inputSchema?: EngineInputSchema;
  pricing?: EnginePricing;
  apiAvailability?: string;
  updatedAt: string;
  ttlSec: number;
  providerMeta?: {
    provider?: string;
    modelSlug?: string;
  };
  pricingDetails?: EnginePricingDetails;
  iconUrl?: string | null;
  fallbackIcon?: string | null;
  availability: EngineAvailability;
  brandId?: string;
  brandAssetPolicy?: BrandAssetPolicy;
}

export interface EnginesResponse {
  engines: EngineCaps[];
}

export interface PreflightRequest {
  engine: string;
  mode: Mode;
  durationSec: number;
  resolution: Resolution;
  aspectRatio: AspectRatio;
  fps: number;
  seedLocked?: boolean;
  loop?: boolean;
  audio?: boolean;
  user?: {
    memberTier?: string;
  };
}

export interface ItemizationLine {
  unit?: string;
  rate?: number;
  seconds?: number;
  subtotal: number;
  type?: string;
  mode?: string;
  tier?: string;
  amount?: number;
  rateDisplay?: string;
}

export interface PreflightResponse {
  ok: boolean;
  currency?: string;
  itemization?: {
    base: ItemizationLine;
    addons: ItemizationLine[];
    fees?: ItemizationLine[];
    discounts: ItemizationLine[];
    taxes: ItemizationLine[];
  };
  total?: number;
  caps?: Partial<EngineCaps>;
  messages?: string[];
  ttlSec?: number;
  pricing?: PricingSnapshot;
  error?: {
    code: string;
    message: string;
    suggestions?: Record<string, unknown>[];
  };
}

export interface EnginePricingDetails {
  currency: string;
  perSecondCents?: {
    default?: number;
    byResolution?: Record<string, number>;
  };
  flatCents?: {
    default?: number;
    byResolution?: Record<string, number>;
  };
  addons?: {
    audio?: { perSecondCents?: number; flatCents?: number };
    upscale4k?: { perSecondCents?: number; flatCents?: number };
    [key: string]: { perSecondCents?: number; flatCents?: number } | undefined;
  };
  maxDurationSec?: number;
}
