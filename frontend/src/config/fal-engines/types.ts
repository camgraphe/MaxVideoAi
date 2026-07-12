import type { EngineCaps, EngineAvailability, Mode } from '../../../types/engines';
import type { ModelPublicationSurfaces } from '../../../config/model-publication';

export type EngineLogoPolicy = 'logoAllowed' | 'textOnly';

type DurationEnumCaps = {
  options: Array<number | string>;
  default?: number | string;
};

type DurationMinCaps = {
  min: number;
  default: number;
};

export type EngineUiDurationCaps = DurationEnumCaps | DurationMinCaps;

export interface EngineUiCaps {
  modes: Mode[];
  duration?: EngineUiDurationCaps;
  frames?: number[];
  resolution?: string[];
  resolutionLocked?: boolean;
  aspectRatio?: string[];
  fps?: number | number[];
  audioToggle?: boolean;
  acceptsImageFormats?: string[];
  maxUploadMB?: number;
  notes?: string;
}

export interface FalEngineModeConfig {
  mode: Mode;
  falModelId: string;
  ui: EngineUiCaps;
}

export interface FalEngineSeoMeta {
  title: string;
  description: string;
  canonicalPath: string;
}

export interface FalEnginePromptHint {
  title: string;
  prompt: string;
  negativePrompt?: string;
  mode: Mode;
  notes?: string;
}

export interface FalEnginePricingHint {
  currency: string;
  amountCents: number;
  durationSeconds?: number;
  resolution?: string;
  label?: string;
}

export interface FalEngineFaqEntry {
  question: string;
  answer: string;
}

export interface FalEngineMedia {
  videoUrl: string;
  imagePath: string;
  altText: string;
}

export interface FalEngineEntry {
  id: string;
  modelSlug: string;
  marketingName: string;
  cardTitle?: string;
  provider: string;
  brandId: string;
  family?: string;
  versionLabel?: string;
  availability: EngineAvailability;
  logoPolicy: EngineLogoPolicy;
  isLegacy?: boolean;
  billingNote?: string;
  engine: EngineCaps;
  modes: FalEngineModeConfig[];
  defaultFalModelId: string;
  seo: FalEngineSeoMeta;
  type?: string;
  seoText?: string;
  demoUrl?: string;
  media?: FalEngineMedia;
  prompts: FalEnginePromptHint[];
  faqs?: FalEngineFaqEntry[];
  pricingHint?: FalEnginePricingHint;
  promptExample?: string;
  category?: 'video' | 'image' | 'audio' | 'multimodal';
  surfaces: ModelPublicationSurfaces;
}

// The interface keeps the existing public type shape while excluding registry-owned fields.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RawFalEngineEntry
  extends Omit<FalEngineEntry, 'modelSlug' | 'family' | 'category' | 'surfaces'> {}
