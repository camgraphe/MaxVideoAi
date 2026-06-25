import type { AppLocale } from '@/i18n/locales';
import type { CompareShowdown } from '@/config/compare-showdowns';

export interface Params {
  locale?: AppLocale;
  slug: string;
}

export type EngineCatalogFeature = {
  value?: boolean;
  note?: string;
};

export type EngineCatalogEntry = {
  engineId: string;
  modelSlug: string;
  marketingName: string;
  provider: string;
  brandId: string;
  versionLabel?: string;
  availability: string;
  logoPolicy: string;
  engine?: {
    modes?: string[];
    maxDurationSec?: number;
    resolutions?: string[];
    aspectRatios?: string[];
    fps?: number[];
    audio?: boolean;
    extend?: boolean;
    keyframes?: boolean;
    motionControls?: boolean;
    params?: Record<string, unknown>;
    pricingDetails?: {
      perSecondCents?: {
        default?: number;
        byResolution?: Record<string, number>;
      };
      addons?: {
        audio_off?: {
          perSecondCents?: number;
        };
      };
    };
    pricing?: {
      base?: number;
      unit?: string;
    };
    avgDurationMs?: number | null;
  };
  modes?: Array<{ mode: string; falModelId?: string }>;
  features?: Record<string, EngineCatalogFeature>;
  bestFor?: string;
  surfaces?: {
    app?: {
      enabled?: boolean;
    };
  };
};

export type EngineScore = {
  engineId?: string;
  modelSlug?: string;
  fidelity?: number;
  visualQuality?: number | null;
  motion?: number;
  anatomy?: number;
  textRendering?: number;
  consistency?: number;
  controllability?: number | null;
  lipsyncQuality?: number;
  sequencingQuality?: number;
  speedStability?: number | null;
  pricing?: number | null;
  last_updated?: string;
};

export type EngineScoresFile = {
  version?: string;
  last_updated?: string;
  scores?: EngineScore[];
};

export type EngineKeySpecsEntry = {
  modelSlug?: string;
  engineId?: string;
  keySpecs?: Record<string, unknown>;
};

export type EngineKeySpecsFile = {
  version?: string;
  last_updated?: string;
  specs?: EngineKeySpecsEntry[];
};

export type CompareSpecValues = {
  textToVideo: string;
  imageToVideo: string;
  videoToVideo: string;
  firstLastFrame: string;
  referenceImageStyle: string;
  referenceVideo: string;
  maxResolution: string;
  maxDuration: string;
  aspectRatios: string;
  fpsOptions: string;
  outputFormats: string;
  audioOutput: string;
  nativeAudioGeneration: string;
  lipSync: string;
  cameraMotionControls: string;
  watermark: string;
};

export type ComparePricingDisplay = {
  headline: string;
  subline: string | null;
  secondaryLines?: string[];
  prices: number[];
  scoreLine?: string;
  scorePrices?: number[];
};

export type ShowdownSide = {
  label?: string;
  jobId?: string;
  videoUrl?: string;
  posterUrl?: string;
  placeholder?: boolean;
};

export type ShowdownEntry = {
  slotId?: string;
  title?: string;
  aspectRatio?: string;
  mode?: CompareShowdown['mode'];
  prompt?: string;
  promptSourceSlug?: string;
  left: ShowdownSide;
  right: ShowdownSide;
};

export type CompareShowdownSlot = CompareShowdown & { left: ShowdownSide; right: ShowdownSide };
