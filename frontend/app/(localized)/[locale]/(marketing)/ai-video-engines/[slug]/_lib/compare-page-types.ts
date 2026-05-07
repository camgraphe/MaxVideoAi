import type { AppLocale } from '@/i18n/locales';

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
  sources?: string[];
};

export type EngineKeySpecsFile = {
  version?: string;
  last_updated?: string;
  specs?: EngineKeySpecsEntry[];
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
  prompt?: string;
  left: ShowdownSide;
  right: ShowdownSide;
};
