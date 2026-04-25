import type { EngineCaps, EngineAvailability, EnginePricingDetails, Mode } from '../../types/engines';
import { getPartnerByBrandId } from '../lib/brand-partners';
import {
  buildDefaultModelPublicationSurfaces,
  LEGACY_COMPARE_INDEXED_ENGINE_SLUGS,
  mergeModelPublicationSurfaces,
  type ModelPublicationSurfaces,
  type PartialModelPublicationSurfaces,
} from '../../config/model-publication';

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

interface RawFalEngineEntry extends Omit<FalEngineEntry, 'surfaces'> {
  surfaces?: PartialModelPublicationSurfaces;
}

// Keep Seedance 2 launch routing and exposure in one place so go-live is a
// single confirmation pass when Fal publishes the final stable IDs.
const SEEDANCE_2_ENDPOINTS = {
  standard: {
    t2v: 'bytedance/seedance-2.0/text-to-video',
    i2v: 'bytedance/seedance-2.0/image-to-video',
    ref2v: 'bytedance/seedance-2.0/reference-to-video',
  },
  fast: {
    t2v: 'bytedance/seedance-2.0/fast/text-to-video',
    i2v: 'bytedance/seedance-2.0/fast/image-to-video',
    ref2v: 'bytedance/seedance-2.0/fast/reference-to-video',
  },
} as const;

const SEEDANCE_2_TOKEN_DIMENSIONS = {
  '480p': {
    auto: { width: 854, height: 480 },
    '21:9': { width: 1120, height: 480 },
    '16:9': { width: 854, height: 480 },
    '4:3': { width: 640, height: 480 },
    '1:1': { width: 480, height: 480 },
    '3:4': { width: 480, height: 640 },
    '9:16': { width: 480, height: 854 },
  },
  '720p': {
    auto: { width: 1280, height: 720 },
    '21:9': { width: 1680, height: 720 },
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 960, height: 720 },
    '1:1': { width: 720, height: 720 },
    '3:4': { width: 720, height: 960 },
    '9:16': { width: 720, height: 1280 },
  },
} as const;

function buildSeedance2PricingDetails(unitPriceUsdPer1kTokens: number): EnginePricingDetails {
  return {
    currency: 'USD',
    tokenPricing: {
      model: 'fal_tokens',
      unitPriceUsdPer1kTokens,
      framesPerSecond: 24,
      defaultAspectRatio: '16:9',
      dimensions: SEEDANCE_2_TOKEN_DIMENSIONS,
      rounding: 'ceil_cent',
    },
  };
}

const SEEDANCE_2_LAUNCH_CONFIG = {
  isLive: true,
  availability: 'available' as EngineAvailability,
  modelPage: {
    indexable: true,
    includeInSitemap: true,
  },
  examples: {
    includeInFamilyResolver: true,
    includeInFamilyCopy: true,
  },
  pricing: {
    includeInEstimator: true,
    featuredScenario: 'seedance-2-family',
  },
  app: {
    variantGroup: 'seedance-2-0',
    standardRank: -2,
    fastRank: -1,
  },
  standard: {
    suggestOpponents: ['veo-3-1', 'kling-3-pro', 'sora-2'],
    publishedPairs: ['veo-3-1', 'kling-3-pro', 'sora-2'],
  },
  fast: {
    suggestOpponents: ['veo-3-1-fast', 'ltx-2-3-fast', 'sora-2'],
    publishedPairs: ['veo-3-1-fast', 'ltx-2-3-fast'],
  },
} as const;

const SEEDANCE_COMPARE_PUBLISHED_SLUGS = Array.from(
  new Set([...LEGACY_COMPARE_INDEXED_ENGINE_SLUGS, 'seedance-2-0-fast'])
);

function getSeedancePublishedPairs(modelSlug: string): string[] {
  return SEEDANCE_COMPARE_PUBLISHED_SLUGS.filter((slug) => slug !== modelSlug);
}

function buildSeedance2Surfaces(
  variant: 'standard' | 'fast',
  variantLabel: 'Standard' | 'Fast'
): PartialModelPublicationSurfaces {
  const variantConfig = variant === 'standard' ? SEEDANCE_2_LAUNCH_CONFIG.standard : SEEDANCE_2_LAUNCH_CONFIG.fast;
  const modelSlug = variant === 'standard' ? 'seedance-2-0' : 'seedance-2-0-fast';
  const discoveryRank =
    variant === 'standard' ? SEEDANCE_2_LAUNCH_CONFIG.app.standardRank : SEEDANCE_2_LAUNCH_CONFIG.app.fastRank;

  return {
    modelPage: {
      indexable: SEEDANCE_2_LAUNCH_CONFIG.modelPage.indexable,
      includeInSitemap: SEEDANCE_2_LAUNCH_CONFIG.modelPage.includeInSitemap,
    },
    examples: {
      includeInFamilyResolver: SEEDANCE_2_LAUNCH_CONFIG.examples.includeInFamilyResolver,
      includeInFamilyCopy: SEEDANCE_2_LAUNCH_CONFIG.examples.includeInFamilyCopy,
    },
    compare: {
      suggestOpponents: [...variantConfig.suggestOpponents],
      publishedPairs: getSeedancePublishedPairs(modelSlug),
      includeInHub: SEEDANCE_2_LAUNCH_CONFIG.isLive,
    },
    app: {
      enabled: SEEDANCE_2_LAUNCH_CONFIG.isLive,
      discoveryRank,
      variantGroup: SEEDANCE_2_LAUNCH_CONFIG.app.variantGroup,
      variantLabel,
    },
    pricing: {
      includeInEstimator: SEEDANCE_2_LAUNCH_CONFIG.pricing.includeInEstimator,
      featuredScenario: SEEDANCE_2_LAUNCH_CONFIG.pricing.featuredScenario,
    },
  };
}

const PIKA_TEXT_TO_VIDEO_ENGINE: EngineCaps = {
  id: 'pika-text-to-video',
  label: 'Pika 2.2 Text & Image to Video',
  provider: 'Pika',
  version: '2.2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {
    cfg_scale: {
      min: 0,
      max: 1,
      default: 0.5,
      step: 0.05,
    },
  },
  inputLimits: {
    imageMaxMB: 25,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'observed',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one still image as the starting frame for the shot.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration_seconds',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10'],
        default: '5',
        min: 5,
        max: 10,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
        default: '720p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 4,
      byResolution: {
        '720p': 4,
        '1080p': 9,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.04,
    byResolution: {
      '720p': 0.04,
      '1080p': 0.09,
    },
    currency: 'USD',
    notes: '$0.20 per 5s / $0.40 per 10s at 720p, $0.45 per 5s / $0.90 per 10s at 1080p',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'pika',
    modelSlug: 'fal-ai/pika/v2.2/text-to-video',
  },
  availability: 'available',
  brandId: 'pika',
};

const VEO_3_1_ENGINE: EngineCaps = {
  id: 'veo-3-1',
  label: 'Google Veo 3.1',
  provider: 'Google',
  version: '3.1',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v', 'fl2v', 'extend'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['auto', '16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one still image as the starting frame for the shot.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        modes: ['ref2v'],
        requiredInModes: ['ref2v'],
        minCount: 1,
        maxCount: 4,
        source: 'either',
      },
      {
        id: 'first_frame_url',
        type: 'image',
        label: 'Start image',
        description: 'Opening frame for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'last_frame_url',
        type: 'image',
        label: 'Last frame',
        description: 'Target ending image for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Extend an existing Veo render from a source clip URL or upload.',
        modes: ['extend'],
        requiredInModes: ['extend'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4s', '6s', '8s'],
        default: '8s',
        min: 4,
        max: 8,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1', 'auto'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
        default: '720p',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Lock motion & noise for iterative runs.',
        modes: ['t2v'],
      },
      {
        id: 'enhance_prompt',
        type: 'enum',
        label: 'Enhance prompt',
        values: ['true', 'false'],
        default: 'false',
        modes: ['t2v'],
      },
      {
        id: 'auto_fix',
        type: 'enum',
        label: 'Auto fix policy',
        values: ['true', 'false'],
        default: 'false',
        modes: ['t2v'],
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'duration',
        type: 'number',
        label: 'Extension duration (seconds)',
        modes: ['extend'],
        min: 1,
        max: 30,
        default: 5,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 40,
    },
    addons: {
      audio_off: {
        perSecondCents: -20,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.4,
    currency: 'USD',
    notes: '$0.40/s with audio, $0.20/s audio off',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google-veo',
    modelSlug: 'fal-ai/veo3.1',
  },
  availability: 'available',
  brandId: 'google-veo',
};

const VEO_3_1_FAST_ENGINE: EngineCaps = {
  id: 'veo-3-1-fast',
  label: 'Google Veo 3.1 Fast',
  provider: 'Google',
  version: '3.1 Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'fl2v', 'extend'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['auto', '9:16', '16:9', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one still image as the starting frame for the shot.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'first_frame_url',
        type: 'image',
        label: 'Start image',
        description: 'Opening frame for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'last_frame_url',
        type: 'image',
        label: 'Last frame',
        description: 'Target ending image for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Extend an existing Veo Fast render from a source clip URL or upload.',
        modes: ['extend'],
        requiredInModes: ['extend'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4s', '6s', '8s'],
        default: '8s',
        min: 4,
        max: 8,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '9:16', '16:9', '1:1'],
        default: 'auto',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
        default: '720p',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Lock motion & noise for iterative runs.',
        modes: ['t2v'],
      },
      {
        id: 'enhance_prompt',
        type: 'enum',
        label: 'Enhance prompt',
        values: ['true', 'false'],
        default: 'false',
        modes: ['t2v'],
      },
      {
        id: 'auto_fix',
        type: 'enum',
        label: 'Auto fix policy',
        values: ['true', 'false'],
        default: 'false',
        modes: ['t2v'],
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'duration',
        type: 'number',
        label: 'Extension duration (seconds)',
        modes: ['extend'],
        min: 1,
        max: 30,
        default: 5,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 15,
    },
    addons: {
      audio_off: {
        perSecondCents: -5,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.15,
    currency: 'USD',
    notes: '$0.15/s with audio, $0.10/s when audio off',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google-veo',
    modelSlug: 'fal-ai/veo3.1/fast',
  },
  availability: 'available',
  brandId: 'google-veo',
};

const VEO_3_1_LITE_ENGINE: EngineCaps = {
  id: 'veo-3-1-lite',
  label: 'Google Veo 3.1 Lite',
  provider: 'Google',
  version: '3.1 Lite',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'fl2v'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['auto', '16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 8,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one still image as the starting frame for the shot.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'first_frame_url',
        type: 'image',
        label: 'Start image',
        description: 'Opening frame for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'last_frame_url',
        type: 'image',
        label: 'Last frame',
        description: 'Target ending image for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4s', '6s', '8s'],
        default: '8s',
        min: 4,
        max: 8,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '16:9', '9:16'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
        default: '720p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Lock motion & noise for iterative runs.',
      },
      {
        id: 'auto_fix',
        type: 'enum',
        label: 'Auto fix policy',
        values: ['true', 'false'],
        default: 'false',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 5,
      byResolution: {
        '720p': 5,
        '1080p': 8,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.05,
    currency: 'USD',
    notes: '$0.05/s at 720p, $0.08/s at 1080p (audio always on)',
  },
  updatedAt: '2026-04-02T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google-veo',
    modelSlug: 'fal-ai/veo3.1/lite',
  },
  availability: 'available',
  brandId: 'google-veo',
};

const LUMA_RAY2_DURATION_VALUES = ['5s', '9s'] as const;
const LUMA_RAY2_RESOLUTION_VALUES = ['540p', '720p', '1080p'] as const;
const LUMA_RAY2_ASPECT_RATIO_VALUES = ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'] as const;
const LUMA_RAY2_REFRAME_ASPECT_RATIO_VALUES = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'] as const;
const LUMA_RAY2_MODIFY_MODE_VALUES = [
  'adhere_1',
  'adhere_2',
  'adhere_3',
  'flex_1',
  'flex_2',
  'flex_3',
  'reimagine_1',
  'reimagine_2',
  'reimagine_3',
] as const;

const LUMA_RAY2_ENGINE: EngineCaps = {
  id: 'lumaRay2',
  label: 'Luma Ray 2',
  provider: 'Luma AI',
  version: 'Ray 2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'v2v', 'reframe'],
  maxDurationSec: 9,
  resolutions: ['540p', '720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
    videoMaxMB: 500,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'i2v'],
        requiredInModes: ['t2v', 'i2v'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one still image to anchor the opening frame for image-to-video.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Upload the video to modify or reframe.',
        modes: ['v2v', 'reframe'],
        requiredInModes: ['v2v', 'reframe'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Optional text guidance for modify and reframe workflows.',
        modes: ['v2v', 'reframe'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        description: 'Optional still reference to steer styling or composition during modify or reframe.',
        modes: ['v2v', 'reframe'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional closing frame for a guided start-to-end transition.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: [...LUMA_RAY2_DURATION_VALUES],
        default: '5s',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...LUMA_RAY2_ASPECT_RATIO_VALUES],
        default: '16:9',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: [...LUMA_RAY2_RESOLUTION_VALUES],
        default: '540p',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'loop',
        type: 'boolean',
        label: 'Loop video',
        default: false,
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'mode',
        type: 'enum',
        label: 'Modify strength',
        description: 'Choose how tightly the source clip should follow the original motion and composition.',
        values: [...LUMA_RAY2_MODIFY_MODE_VALUES],
        default: 'flex_1',
        modes: ['v2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Reframe aspect ratio',
        description: 'Choose the new framing for the output clip.',
        values: [...LUMA_RAY2_REFRAME_ASPECT_RATIO_VALUES],
        default: '9:16',
        modes: ['reframe'],
      },
      {
        id: 'grid_position_x',
        type: 'number',
        label: 'Grid position X',
        description: 'Optional horizontal grid anchor for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'grid_position_y',
        type: 'number',
        label: 'Grid position Y',
        description: 'Optional vertical grid anchor for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'x_start',
        type: 'number',
        label: 'Crop start X',
        description: 'Optional left crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'x_end',
        type: 'number',
        label: 'Crop end X',
        description: 'Optional right crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'y_start',
        type: 'number',
        label: 'Crop start Y',
        description: 'Optional top crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'y_end',
        type: 'number',
        label: 'Crop end Y',
        description: 'Optional bottom crop boundary for the reframe window.',
        modes: ['reframe'],
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm', 'm4v', 'gif'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 500,
    },
  },
  updatedAt: '2026-04-02T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'luma',
    modelSlug: 'fal-ai/luma-dream-machine/ray-2',
  },
  availability: 'available',
  brandId: 'luma',
};

const LUMA_RAY2_FLASH_ENGINE: EngineCaps = {
  id: 'lumaRay2_flash',
  label: 'Luma Ray 2 Flash',
  provider: 'Luma AI',
  version: 'Ray 2 Flash',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'v2v', 'reframe'],
  maxDurationSec: 9,
  resolutions: ['540p', '720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
    videoMaxMB: 500,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'i2v'],
        requiredInModes: ['t2v', 'i2v'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one still image to anchor the opening frame for image-to-video.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Upload the video to modify or reframe.',
        modes: ['v2v', 'reframe'],
        requiredInModes: ['v2v', 'reframe'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Optional text guidance for modify and reframe workflows.',
        modes: ['v2v', 'reframe'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        description: 'Optional still reference to steer styling or composition during modify or reframe.',
        modes: ['v2v', 'reframe'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional closing frame for a guided start-to-end transition.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: [...LUMA_RAY2_DURATION_VALUES],
        default: '5s',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...LUMA_RAY2_ASPECT_RATIO_VALUES],
        default: '16:9',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: [...LUMA_RAY2_RESOLUTION_VALUES],
        default: '540p',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'loop',
        type: 'boolean',
        label: 'Loop video',
        default: false,
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'mode',
        type: 'enum',
        label: 'Modify strength',
        description: 'Choose how tightly the source clip should follow the original motion and composition.',
        values: [...LUMA_RAY2_MODIFY_MODE_VALUES],
        default: 'flex_1',
        modes: ['v2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Reframe aspect ratio',
        description: 'Choose the new framing for the output clip.',
        values: [...LUMA_RAY2_REFRAME_ASPECT_RATIO_VALUES],
        default: '9:16',
        modes: ['reframe'],
      },
      {
        id: 'grid_position_x',
        type: 'number',
        label: 'Grid position X',
        description: 'Optional horizontal grid anchor for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'grid_position_y',
        type: 'number',
        label: 'Grid position Y',
        description: 'Optional vertical grid anchor for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'x_start',
        type: 'number',
        label: 'Crop start X',
        description: 'Optional left crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'x_end',
        type: 'number',
        label: 'Crop end X',
        description: 'Optional right crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'y_start',
        type: 'number',
        label: 'Crop start Y',
        description: 'Optional top crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'y_end',
        type: 'number',
        label: 'Crop end Y',
        description: 'Optional bottom crop boundary for the reframe window.',
        modes: ['reframe'],
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm', 'm4v', 'gif'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 500,
    },
  },
  updatedAt: '2026-04-02T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'luma',
    modelSlug: 'fal-ai/luma-dream-machine/ray-2-flash',
  },
  availability: 'available',
  brandId: 'luma',
};

const SORA_2_ENGINE: EngineCaps = {
  id: 'sora-2',
  label: 'OpenAI Sora 2',
  provider: 'OpenAI',
  version: '2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 12,
  resolutions: ['720p'],
  aspectRatios: ['auto', '16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 50,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4', '8', '12'],
        default: '4',
        min: 4,
        max: 12,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '16:9', '9:16'],
        default: 'auto',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p'],
        default: '720p',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Image input',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 10,
      byResolution: {
        '720p': 10,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.1,
    currency: 'USD',
    notes: '$0.10/s via Fal routing (720p guidance)',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'openai',
    modelSlug: 'fal-ai/sora-2/text-to-video',
  },
  availability: 'available',
  brandId: 'openai',
};

const SORA_2_PRO_ENGINE: EngineCaps = {
  id: 'sora-2-pro',
  label: 'OpenAI Sora 2 Pro',
  provider: 'OpenAI',
  version: 'Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 12,
  resolutions: ['720p', '1080p', 'auto'],
  aspectRatios: ['16:9', '9:16', 'auto'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 75,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4', '8', '12'],
        default: '4',
        min: 4,
        max: 12,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', 'auto'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p', 'auto'],
        default: '1080p',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Image input',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 30,
      byResolution: {
        '720p': 30,
        '1080p': 50,
        auto: 30,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.3,
    currency: 'USD',
    notes: '$0.30/s at 720p, $0.50/s at 1080p',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'openai',
    modelSlug: 'fal-ai/sora-2/text-to-video/pro',
  },
  availability: 'available',
  brandId: 'openai',
};

const KLING_2_5_TURBO_ENGINE: EngineCaps = {
  id: 'kling-2-5-turbo',
  label: 'Kling 2.5 Turbo',
  provider: 'Kling by Kuaishou',
  version: '2.5 Turbo',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'i2i'],
  maxDurationSec: 10,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'observed',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v', 'i2i'],
        requiredInModes: ['i2v', 'i2i'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration_seconds',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10'],
        default: '5',
        min: 5,
        max: 10,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
        default: '720p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
        default: 'blur, distort, and low quality',
      },
      {
        id: 'cfg_scale',
        type: 'number',
        label: 'CFG scale (0-1)',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 7,
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.07,
    currency: 'USD',
    notes: '$0.35 per 5s on Pro tiers; Standard image mode billed at $0.21 per 5s.',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'kling',
    modelSlug: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
  },
  availability: 'available',
  brandId: 'kling',
};

const KLING_2_6_PRO_ENGINE: EngineCaps = {
  id: 'kling-2-6-pro',
  label: 'Kling 2.6 Pro',
  provider: 'Kling by Kuaishou',
  version: '2.6 Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: ['1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {
    cfg_scale: {
      min: 0,
      max: 1,
      default: 0.5,
      step: 0.05,
    },
  },
  inputLimits: {
    imageMaxMB: 25,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'observed',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'reference_image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Use 1 to 9 stills to lock identity, styling, and continuity across the clip.',
        modes: ['ref2v'],
        requiredInModes: ['ref2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10'],
        default: '5',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1080p'],
        default: '1080p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
        default: 'blur, distort, and low quality',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'cfg_scale',
        type: 'number',
        label: 'CFG scale',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 14,
    },
    addons: {
      audio_off: {
        perSecondCents: -7,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.14,
    currency: 'USD',
    notes: '$0.14/s with audio on; $0.07/s audio off',
  },
  updatedAt: '2025-03-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'kling',
    modelSlug: 'fal-ai/kling-video/v2.6/pro/text-to-video',
  },
  availability: 'available',
  brandId: 'kling',
};

const KLING_3_PRO_ENGINE: EngineCaps = {
  id: 'kling-3-pro',
  label: 'Kling 3 Pro',
  provider: 'Kling by Kuaishou',
  version: '3 Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 15,
  resolutions: ['1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {
    cfg_scale: {
      min: 0,
      max: 1,
      default: 0.5,
      step: 0.05,
    },
  },
  inputLimits: {
    imageMaxMB: 25,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'observed',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        default: '5',
        min: 3,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1'],
        default: '16:9',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
        default: 'blur, distort, and low quality',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'cfg_scale',
        type: 'number',
        label: 'CFG scale',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End frame (optional)',
        modes: ['i2v'],
        minCount: 0,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 16.8,
    },
    addons: {
      audio_off: {
        perSecondCents: -5.6,
      },
      voice_control: {
        perSecondCents: 2.8,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.168,
    currency: 'USD',
    notes: 'Fal cost: $0.112/s audio off, $0.168/s audio on, $0.196/s voice control. MaxVideoAI display prices add platform margin before showing quotes.',
  },
  updatedAt: '2026-04-25T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'kling',
    modelSlug: 'fal-ai/kling-video/v3/pro/text-to-video',
  },
  availability: 'available',
  brandId: 'kling',
};

const KLING_3_STANDARD_ENGINE: EngineCaps = {
  id: 'kling-3-standard',
  label: 'Kling 3 Standard',
  provider: 'Kling by Kuaishou',
  version: '3 Standard',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 15,
  resolutions: ['1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {
    cfg_scale: {
      min: 0,
      max: 1,
      default: 0.5,
      step: 0.05,
    },
  },
  inputLimits: {
    imageMaxMB: 25,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'observed',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        default: '5',
        min: 3,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1'],
        default: '16:9',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
        default: 'blur, distort, and low quality',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'cfg_scale',
        type: 'number',
        label: 'CFG scale',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End frame (optional)',
        modes: ['i2v'],
        minCount: 0,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 12.6,
    },
    addons: {
      audio_off: {
        perSecondCents: -4.2,
      },
      voice_control: {
        perSecondCents: 2.8,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.126,
    currency: 'USD',
    notes: 'Fal cost: $0.084/s audio off, $0.126/s audio on, $0.154/s voice control. MaxVideoAI display prices add platform margin before showing quotes.',
  },
  updatedAt: '2026-04-25T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'kling',
    modelSlug: 'fal-ai/kling-video/v3/standard/text-to-video',
  },
  availability: 'available',
  brandId: 'kling',
};

const KLING_3_4K_ENGINE: EngineCaps = {
  id: 'kling-3-4k',
  label: 'Kling 3 4K',
  provider: 'Kling by Kuaishou',
  version: '3 4K',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 15,
  resolutions: ['4k'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {
    cfg_scale: {
      min: 0,
      max: 1,
      default: 0.5,
      step: 0.05,
    },
  },
  inputLimits: {
    imageMaxMB: 25,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'observed',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        default: '5',
        min: 3,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['4k'],
        default: '4k',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
        default: 'blur, distort, and low quality',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'cfg_scale',
        type: 'number',
        label: 'CFG scale',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End frame (optional)',
        modes: ['i2v'],
        minCount: 0,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 42,
      byResolution: {
        '4k': 42,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.42,
    byResolution: {
      '4k': 0.42,
    },
    currency: 'USD',
    notes: 'Fal cost: $0.420/s native 4K output. MaxVideoAI display prices add platform margin before showing quotes.',
  },
  updatedAt: '2026-04-25T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'kling',
    modelSlug: 'fal-ai/kling-video/v3/4k/text-to-video',
  },
  availability: 'available',
  brandId: 'kling',
};

const SEEDANCE_1_5_PRO_ENGINE: EngineCaps = {
  id: 'seedance-1-5-pro',
  label: 'Seedance 1.5 Pro',
  provider: 'ByteDance',
  version: '1.5 Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 12,
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End frame (optional)',
        modes: ['i2v'],
        minCount: 0,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['4', '5', '6', '7', '8', '9', '10', '11', '12'],
        default: '5',
        min: 4,
        max: 12,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['480p', '720p', '1080p'],
        default: '720p',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'camera_fixed',
        type: 'enum',
        label: 'Camera fixed',
        values: ['true', 'false'],
        default: 'false',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Use -1 for random.',
      },
      {
        id: 'enable_safety_checker',
        type: 'enum',
        label: 'Safety checker',
        values: ['true', 'false'],
        default: 'true',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 5.184,
      byResolution: {
        '480p': 2.306,
        '720p': 5.184,
        '1080p': 11.664,
      },
    },
    addons: {
      audio_off: {
        perSecondCents: -2.592,
        perSecondCentsByResolution: {
          '480p': -1.153,
          '720p': -2.592,
          '1080p': -5.832,
        },
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.05184,
    byResolution: {
      '480p': 0.02306,
      '720p': 0.05184,
      '1080p': 0.11664,
    },
    currency: 'USD',
    notes: '$0.023/s 480p, $0.052/s 720p, $0.117/s 1080p with audio; 50% off without audio',
  },
  updatedAt: '2026-02-10T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'bytedance',
    modelSlug: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
  },
  availability: 'available',
  brandId: 'bytedance',
};

const SEEDANCE_2_0_ENGINE: EngineCaps = {
  id: 'seedance-2-0',
  label: 'Seedance 2.0',
  provider: 'ByteDance',
  version: '2.0',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 15,
  resolutions: ['480p', '720p'],
  aspectRatios: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 30,
    videoMaxMB: 50,
    audioMaxMB: 15,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional last frame for start-to-end transitions in image-to-video.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['auto', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        default: 'auto',
        min: 4,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        default: 'auto',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['480p', '720p'],
        default: '720p',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images (up to 9)',
        description: 'Optional reference stills for identity, styling, and continuity. Fal allows up to 9 images and 12 total files across all reference inputs.',
        modes: ['ref2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
      },
      {
        id: 'video_urls',
        type: 'video',
        label: 'Reference video clips (up to 3)',
        description: 'Optional motion or pacing references for ref2v. Fal allows up to 3 videos, 2 to 15 seconds combined, under 50 MB total.',
        minCount: 0,
        maxCount: 3,
        modes: ['ref2v'],
        source: 'either',
      },
      {
        id: 'audio_urls',
        type: 'audio',
        label: 'Reference audio clips (up to 3)',
        description: 'Optional soundtrack, dialogue, or rhythm references for ref2v. Fal allows up to 3 files, max 15 MB each, and requires at least one image or video reference if audio is used.',
        minCount: 0,
        maxCount: 3,
        modes: ['ref2v'],
        source: 'either',
      },
      {
        id: 'generate_audio',
        type: 'boolean',
        label: 'Audio',
        default: true,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mp3', 'wav'],
      maxImageSizeMB: 30,
      maxVideoSizeMB: 50,
      maxAudioSizeMB: 15,
    },
  },
  pricingDetails: buildSeedance2PricingDetails(0.014),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes: 'Fal bills Seedance 2 from output tokens. MaxVideoAI adds its margin and rounds up to the next cent before showing the live quote.',
  },
  updatedAt: '2026-04-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'bytedance',
    modelSlug: SEEDANCE_2_ENDPOINTS.standard.t2v,
  },
  availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
  brandId: 'bytedance',
};

const SEEDANCE_2_0_FAST_ENGINE: EngineCaps = {
  id: 'seedance-2-0-fast',
  label: 'Seedance 2.0 Fast',
  provider: 'ByteDance',
  version: '2.0',
  variant: 'Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 15,
  resolutions: ['480p', '720p'],
  aspectRatios: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 30,
    videoMaxMB: 50,
    audioMaxMB: 15,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional last frame for start-to-end transitions in image-to-video.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['auto', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        default: 'auto',
        min: 4,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        default: 'auto',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['480p', '720p'],
        default: '720p',
      },
      {
        id: 'generate_audio',
        type: 'boolean',
        label: 'Audio',
        default: true,
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images (up to 9)',
        description: 'Optional still references for draft continuity checks. Fal allows up to 9 images and 12 total files across all reference inputs.',
        modes: ['ref2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
      },
      {
        id: 'video_urls',
        type: 'video',
        label: 'Reference video clips (up to 3)',
        description: 'Optional pacing or motion references for draft-speed ref2v runs. Fal allows up to 3 videos, 2 to 15 seconds combined, under 50 MB total.',
        minCount: 0,
        maxCount: 3,
        modes: ['ref2v'],
        source: 'either',
      },
      {
        id: 'audio_urls',
        type: 'audio',
        label: 'Reference audio clips (up to 3)',
        description: 'Optional soundtrack or rhythm references for ref2v. Fal allows up to 3 files, max 15 MB each, and requires at least one image or video reference if audio is used.',
        minCount: 0,
        maxCount: 3,
        modes: ['ref2v'],
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mp3', 'wav'],
      maxImageSizeMB: 30,
      maxVideoSizeMB: 50,
      maxAudioSizeMB: 15,
    },
  },
  pricingDetails: buildSeedance2PricingDetails(0.0112),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes: 'Fal bills Seedance 2 Fast from output tokens. MaxVideoAI adds its margin and rounds up to the next cent before showing the live quote.',
  },
  updatedAt: '2026-04-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'bytedance',
    modelSlug: SEEDANCE_2_ENDPOINTS.fast.t2v,
  },
  availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
  brandId: 'bytedance',
};

const WAN_2_5_ENGINE: EngineCaps = {
  id: 'wan-2-5',
  label: 'Wan 2.5 Text & Image to Video',
  provider: 'Wan',
  version: '2.5 Preview',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
    videoMaxMB: 15,
    promptMaxChars: 800,
    promptMaxCharsSource: 'official',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'audio_url',
        type: 'text',
        label: 'Audio URL',
        description: 'Optional WAV/MP3 soundtrack (3-30s, ≤15MB).',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10'],
        default: '5',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['480p', '720p', '1080p'],
        default: '1080p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'enable_prompt_expansion',
        type: 'enum',
        label: 'Prompt expansion',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'enable_safety_checker',
        type: 'enum',
        label: 'Safety checker',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 5,
      byResolution: {
        '480p': 5,
        '720p': 10,
        '1080p': 15,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.05,
    byResolution: {
      '480p': 0.05,
      '720p': 0.1,
      '1080p': 0.15,
    },
    currency: 'USD',
    notes: '$0.25 per 5s @480p, $0.50 per 5s @720p, $0.75 per 5s @1080p',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'wan',
    modelSlug: 'fal-ai/wan-25-preview/text-to-video',
  },
  availability: 'available',
  brandId: 'wan',
};

const WAN_2_6_ENGINE: EngineCaps = {
  id: 'wan-2-6',
  label: 'Wan 2.6 Text & Image to Video',
  provider: 'Wan',
  version: '2.6',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'r2v'],
  maxDurationSec: 15,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
    videoMaxMB: 30,
    videoMaxDurationSec: 30,
    promptMaxChars: 800,
    promptMaxCharsSource: 'official',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_urls',
        type: 'video',
        label: 'Reference videos',
        modes: ['r2v'],
        requiredInModes: ['r2v'],
        minCount: 1,
        maxCount: 3,
        source: 'upload',
      },
    ],
    optional: [
      {
        id: 'audio_url',
        type: 'text',
        label: 'Audio URL',
        description: 'Optional WAV/MP3 soundtrack (3-30s, <=15MB).',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10', '15'],
        default: '5',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1', '4:3', '3:4'],
        default: '16:9',
        modes: ['t2v', 'r2v'],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
        default: '1080p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'enable_prompt_expansion',
        type: 'enum',
        label: 'Prompt expansion',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'multi_shots',
        type: 'enum',
        label: 'Multi-shot',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'enable_safety_checker',
        type: 'enum',
        label: 'Safety checker',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
      maxVideoSizeMB: 30,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 10,
      byResolution: {
        '720p': 10,
        '1080p': 15,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.1,
    byResolution: {
      '720p': 0.1,
      '1080p': 0.15,
    },
    currency: 'USD',
    notes: '$0.50 per 5s @720p, $0.75 per 5s @1080p',
  },
  updatedAt: '2025-03-20T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'wan',
    modelSlug: 'wan/v2.6/text-to-video',
  },
  availability: 'available',
  brandId: 'wan',
};

const LTX_2_FAST_ENGINE: EngineCaps = {
  id: 'ltx-2-fast',
  label: 'LTX Video 2.0 Fast',
  provider: 'Lightricks',
  version: '2.0 Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 20,
  resolutions: ['1080p', '1440p', '4k'],
  aspectRatios: ['16:9'],
  fps: [25, 50],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['6', '8', '10', '12', '14', '16', '18', '20'],
        default: '6',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1080p', '1440p', '4k'],
        default: '1080p',
      },
      {
        id: 'fps',
        type: 'enum',
        label: 'Frames per second',
        values: ['25', '50'],
        default: '25',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 4,
      byResolution: {
        '1080p': 4,
        '1440p': 8,
        '4k': 16,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.04,
    byResolution: {
      '1080p': 0.04,
      '1440p': 0.08,
      '4k': 0.16,
    },
    currency: 'USD',
    notes: '$0.26 per 5s @1080p, $0.52 @1440p, $1.04 @4K',
  },
  updatedAt: '2025-03-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'lightricks',
    modelSlug: 'fal-ai/ltx-2/text-to-video/fast',
  },
  availability: 'available',
  brandId: 'lightricks',
};

const LTX_2_ENGINE: EngineCaps = {
  id: 'ltx-2',
  label: 'LTX Video 2.0 Pro',
  provider: 'Lightricks',
  version: '2.0 Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: ['1080p', '1440p', '4k'],
  aspectRatios: ['16:9'],
  fps: [25, 50],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['6', '8', '10'],
        default: '6',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1080p', '1440p', '4k'],
        default: '1080p',
      },
      {
        id: 'fps',
        type: 'enum',
        label: 'Frames per second',
        values: ['25', '50'],
        default: '25',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 6,
      byResolution: {
        '1080p': 6,
        '1440p': 12,
        '4k': 24,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.06,
    byResolution: {
      '1080p': 0.06,
      '1440p': 0.12,
      '4k': 0.24,
    },
    currency: 'USD',
    notes: '$0.39 per 5s @1080p, $0.78 @1440p, $1.56 @4K',
  },
  updatedAt: '2025-03-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'lightricks',
    modelSlug: 'fal-ai/ltx-2/text-to-video',
  },
  availability: 'available',
  brandId: 'lightricks',
};

const LTX_2_3_FAST_ENGINE: EngineCaps = {
  id: 'ltx-2-3-fast',
  label: 'LTX 2.3 Fast',
  provider: 'Lightricks',
  version: '2.3 Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 20,
  resolutions: ['1080p', '1440p', '4k'],
  aspectRatios: ['16:9', '9:16'],
  fps: [24, 25, 48, 50],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Used as the first frame for image-to-video generation.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['6', '8', '10', '12', '14', '16', '18', '20'],
        default: '6',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1080p', '1440p', '4k'],
        default: '1080p',
      },
      {
        id: 'fps',
        type: 'enum',
        label: 'Frames per second',
        values: ['24', '25', '48', '50'],
        default: '25',
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional end frame for a start-to-end transition.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'guidance_scale',
        type: 'number',
        label: 'Guidance scale',
        description: 'Adjust prompt adherence for LTX 2.3 Fast.',
        modes: ['i2v'],
        min: 1,
        max: 50,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heif'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 4,
      byResolution: {
        '1080p': 4,
        '1440p': 8,
        '4k': 16,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.04,
    byResolution: {
      '1080p': 0.04,
      '1440p': 0.08,
      '4k': 0.16,
    },
    currency: 'USD',
    notes: '$0.31 per 6s @1080p, $0.62 @1440p, $1.25 @4K. Durations above 10s require 1080p / 25 fps.',
  },
  updatedAt: '2026-03-06T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'lightricks',
    modelSlug: 'fal-ai/ltx-2.3/text-to-video/fast',
  },
  availability: 'available',
  brandId: 'lightricks',
};

const LTX_2_3_ENGINE: EngineCaps = {
  id: 'ltx-2-3',
  label: 'LTX 2.3 Pro',
  provider: 'Lightricks',
  version: '2.3 Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'a2v', 'extend', 'retake'],
  maxDurationSec: 20,
  resolutions: ['1080p', '1440p', '4k'],
  aspectRatios: ['16:9', '9:16'],
  fps: [24, 25, 48, 50],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
    videoMaxMB: 30,
    audioMaxMB: 30,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'i2v', 'retake'],
        requiredInModes: ['t2v', 'i2v', 'retake'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Used as the first frame for image-to-video generation.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'audio_url',
        type: 'audio',
        label: 'Source audio',
        description: 'Video duration follows the audio length. Use an audio file between 2 and 20 seconds.',
        modes: ['a2v'],
        requiredInModes: ['a2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
        minDurationSec: 2,
        maxDurationSec: 20,
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        modes: ['extend', 'retake'],
        requiredInModes: ['extend', 'retake'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['a2v', 'extend'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Optional first frame to anchor the audio-driven clip.',
        modes: ['a2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional end frame for a start-to-end transition.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['6', '8', '10'],
        default: '6',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16'],
        default: '16:9',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1080p', '1440p', '4k'],
        default: '1080p',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'fps',
        type: 'enum',
        label: 'Frames per second',
        values: ['24', '25', '48', '50'],
        default: '25',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'guidance_scale',
        type: 'number',
        label: 'Guidance scale',
        description: 'Adjust prompt adherence for LTX 2.3.',
        modes: ['i2v', 'a2v'],
        min: 1,
        max: 50,
      },
      {
        id: 'duration',
        type: 'number',
        label: 'Extension duration (seconds)',
        modes: ['extend'],
        min: 1,
        max: 20,
        default: 5,
      },
      {
        id: 'mode',
        type: 'enum',
        label: 'Extend position',
        modes: ['extend'],
        values: ['start', 'end'],
        default: 'end',
      },
      {
        id: 'context',
        type: 'number',
        label: 'Context window (seconds)',
        modes: ['extend'],
        min: 0,
        max: 20,
      },
      {
        id: 'start_time',
        type: 'number',
        label: 'Start time (seconds)',
        modes: ['retake'],
        min: 0,
        max: 20,
        default: 0,
      },
      {
        id: 'duration',
        type: 'number',
        label: 'Retake duration (seconds)',
        modes: ['retake'],
        min: 2,
        max: 20,
        default: 5,
      },
      {
        id: 'retake_mode',
        type: 'enum',
        label: 'Retake mode',
        modes: ['retake'],
        values: ['replace_audio', 'replace_video', 'replace_audio_and_video'],
        default: 'replace_audio_and_video',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heif'],
      maxImageSizeMB: 25,
      maxVideoSizeMB: 30,
      maxAudioSizeMB: 30,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 6,
      byResolution: {
        '1080p': 6,
        '1440p': 12,
        '4k': 24,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.06,
    byResolution: {
      '1080p': 0.06,
      '1440p': 0.12,
      '4k': 0.24,
    },
    currency: 'USD',
    notes: '$0.47 per 6s @1080p, $0.94 @1440p, $1.87 @4K',
  },
  updatedAt: '2026-03-06T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'lightricks',
    modelSlug: 'fal-ai/ltx-2.3/text-to-video',
  },
  availability: 'available',
  brandId: 'lightricks',
};

const HAILUO_ENGINE: EngineCaps = {
  id: 'minimax-hailuo-02-text',
  label: 'MiniMax Hailuo 02 Standard',
  provider: 'MiniMax',
  version: 'Standard',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: ['512P', '768P'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [25],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 20,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['6', '10'],
        default: '6',
        min: 6,
        max: 10,
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['512P', '768P'],
        default: '768P',
      },
      {
        id: 'prompt_optimizer',
        type: 'enum',
        label: 'Prompt optimiser',
        values: ['on', 'off'],
        default: 'on',
        modes: ['t2v'],
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End frame (optional)',
        modes: ['i2v'],
        minCount: 0,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 4.5,
      byResolution: {
        '512P': 4,
        '768P': 4.5,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.045,
    currency: 'USD',
    notes: '$0.045/s standard tier',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'minimax',
    modelSlug: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
  },
  availability: 'available',
  brandId: 'minimax',
};

const NANO_BANANA_ENGINE: EngineCaps = {
  id: 'nano-banana',
  label: 'Nano Banana',
  provider: 'Google',
  version: 'Nano',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 8,
  resolutions: ['square_hd', 'landscape_hd', 'portrait_hd'],
  aspectRatios: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
  fps: [1],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe what you want Nano Banana to create.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Number of images',
        min: 1,
        max: 8,
        step: 1,
        default: 1,
        description: 'Batch size per call (max 8).',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['t2i'],
        values: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: '1:1',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['i2i'],
        values: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: 'auto',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Image inputs',
        description: 'Provide source images when using Edit mode.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 4,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    flatCents: {
      default: 4,
    },
  },
  pricing: {
    unit: 'image',
    base: 0.039,
    currency: 'USD',
    notes: '$0.039 per generated image',
  },
  updatedAt: '2025-03-01T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'fal.ai',
    modelSlug: 'fal-ai/nano-banana',
  },
  availability: 'available',
  brandId: 'google',
};

const NANO_BANANA_PRO_ENGINE: EngineCaps = {
  id: 'nano-banana-pro',
  label: 'Nano Banana Pro',
  provider: 'Google',
  version: 'Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 8,
  resolutions: ['2k', '4k'],
  aspectRatios: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
  fps: [1],
  audio: false,
  upscale4k: true,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the scene, subject, lighting, and any typography you need rendered.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Number of images',
        min: 1,
        max: 8,
        step: 1,
        default: 1,
        description: 'Batch studio-quality outputs (max 8 per run).',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Upload reference stills when using edit or multi-image workflows.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 4,
        source: 'either',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['2k', '4k'],
        default: '2k',
        description: '2K render at base price; 4K doubles the per-image cost.',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['t2i'],
        values: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: '1:1',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['i2i'],
        values: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: 'auto',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Lock randomness to iterate on the same framing.',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 15,
      byResolution: {
        '1k': 15,
        '2k': 15,
        '4k': 30,
      },
    },
    flatCents: {
      default: 15,
      byResolution: {
        '1k': 15,
        '2k': 15,
        '4k': 30,
      },
    },
  },
  pricing: {
    unit: 'image',
    base: 0.15,
    currency: 'USD',
    notes: '$0.15 per 1K/2K image, $0.30 at 4K',
  },
  updatedAt: '2025-03-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'fal.ai',
    modelSlug: 'fal-ai/nano-banana-pro',
  },
  availability: 'available',
  brandId: 'google',
};

const NANO_BANANA_2_ENGINE: EngineCaps = {
  id: 'nano-banana-2',
  label: 'Nano Banana 2',
  provider: 'Google',
  version: '2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 4,
  resolutions: ['0.5k', '1k', '2k', '4k'],
  aspectRatios: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
  fps: [1],
  audio: false,
  upscale4k: true,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the still you want to generate or the edit you want applied.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Number of images',
        min: 1,
        max: 4,
        step: 1,
        default: 1,
        description: 'Generate up to 4 images per request.',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Add 1-14 reference images for edit mode.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 14,
        source: 'either',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['0.5k', '1k', '2k', '4k'],
        default: '1k',
        description: '0.5K runs at half price, 2K is 1.5x, and 4K is 2x.',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
        default: 'auto',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Reuse a seed to iterate on the same composition.',
      },
      {
        id: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: ['jpeg', 'png', 'webp'],
        default: 'jpeg',
      },
      {
        id: 'enable_web_search',
        type: 'boolean',
        label: 'Enable web search',
        default: false,
        description: 'Optional web grounding adds $0.015 per request.',
      },
      {
        id: 'thinking_level',
        type: 'enum',
        label: 'Thinking level',
        values: ['minimal', 'high'],
        default: 'minimal',
      },
      {
        id: 'limit_generations',
        type: 'boolean',
        label: 'Limit generations',
        default: false,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 8,
      byResolution: {
        '0.5k': 4,
        '1k': 8,
        '2k': 12,
        '4k': 16,
      },
    },
    flatCents: {
      default: 8,
      byResolution: {
        '0.5k': 4,
        '1k': 8,
        '2k': 12,
        '4k': 16,
      },
    },
    addons: {
      enable_web_search: {
        flatCents: 1.5,
      },
    },
  },
  pricing: {
    unit: 'image',
    base: 0.08,
    byResolution: {
      '0.5k': 0.04,
      '1k': 0.08,
      '2k': 0.12,
      '4k': 0.16,
    },
    addons: {
      enable_web_search: {
        flat: 0.015,
      },
    },
    currency: 'USD',
    notes: '$0.08 per 1K image, $0.04 at 0.5K, $0.12 at 2K, $0.16 at 4K, plus $0.015/request for web search.',
  },
  updatedAt: '2026-03-17T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'fal.ai',
    modelSlug: 'fal-ai/nano-banana-2',
  },
  availability: 'available',
  brandId: 'google',
};

const GPT_IMAGE_2_ENGINE: EngineCaps = {
  id: 'gpt-image-2',
  label: 'GPT Image 2',
  provider: 'OpenAI',
  version: '2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 4,
  resolutions: ['landscape_4_3', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9', 'landscape_16_9', 'custom', 'auto'],
  aspectRatios: ['auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [1],
  audio: false,
  upscale4k: true,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the image to generate, or the edit to apply to the references.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Number of images',
        min: 1,
        max: 4,
        step: 1,
        default: 1,
        description: 'Generate up to 4 images per request.',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Add source images for edit mode.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 4,
        source: 'either',
      },
      {
        id: 'resolution',
        engineParam: 'image_size',
        type: 'enum',
        label: 'Image size',
        modes: ['t2i'],
        values: [
          'landscape_4_3',
          'square_hd',
          'square',
          'portrait_4_3',
          'portrait_16_9',
          'landscape_16_9',
          '1024x768',
          '1024x1024',
          '1024x1536',
          '1920x1080',
          '2560x1440',
          '3840x2160',
          'custom',
        ],
        default: 'landscape_4_3',
        description: 'Fal image_size preset or canonical custom size for text-to-image requests.',
      },
      {
        id: 'resolution',
        engineParam: 'image_size',
        type: 'enum',
        label: 'Image size',
        modes: ['i2i'],
        values: [
          'auto',
          'landscape_4_3',
          'square_hd',
          'square',
          'portrait_4_3',
          'portrait_16_9',
          'landscape_16_9',
          '1024x768',
          '1024x1024',
          '1024x1536',
          '1920x1080',
          '2560x1440',
          '3840x2160',
          'custom',
        ],
        default: 'auto',
        description: 'Use auto to infer the output size, or send a Fal image_size preset/custom object.',
      },
      {
        id: 'image_width',
        engineParam: 'image_size.width',
        type: 'number',
        label: 'Custom width',
        modes: ['t2i', 'i2i'],
        min: 16,
        max: 3840,
        step: 16,
        default: 1024,
        description: 'Used when Image size is Custom. Fal requires multiples of 16 and max edge 3840px.',
      },
      {
        id: 'image_height',
        engineParam: 'image_size.height',
        type: 'number',
        label: 'Custom height',
        modes: ['t2i', 'i2i'],
        min: 16,
        max: 3840,
        step: 16,
        default: 768,
        description: 'Used when Image size is Custom. Total pixels must stay between 655,360 and 8,294,400.',
      },
      {
        id: 'quality',
        type: 'enum',
        label: 'Quality',
        values: ['low', 'medium', 'high'],
        default: 'high',
        description: 'Higher quality costs more and improves fidelity.',
      },
      {
        id: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: ['png', 'jpeg', 'webp'],
        default: 'png',
      },
      {
        id: 'mask_url',
        type: 'image',
        label: 'Mask image URL',
        description: 'Optional public mask image URL for edit requests.',
        modes: ['i2i'],
        minCount: 0,
        maxCount: 1,
        source: 'url',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
      imageSize: {
        multipleOf: 16,
        minPixels: 655360,
        maxPixels: 8294400,
        maxEdge: 3840,
        maxAspectRatio: 3,
      },
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 15,
      byResolution: {
        '1024x768': 15,
        '1024x1024': 22,
        '1024x1536': 17,
        '1920x1080': 16,
        '2560x1440': 23,
        '3840x2160': 41,
        landscape_4_3: 15,
        portrait_4_3: 15,
        square: 22,
        square_hd: 22,
        portrait_16_9: 17,
        landscape_16_9: 16,
        custom: 15,
        auto: 22,
      },
    },
  },
  pricing: {
    unit: 'image',
    base: 0.15,
    byResolution: {
      '1024x768': 0.15,
      '1024x1024': 0.22,
      '1024x1536': 0.17,
      '1920x1080': 0.16,
      '2560x1440': 0.23,
      '3840x2160': 0.41,
      landscape_4_3: 0.15,
      portrait_4_3: 0.15,
      square: 0.22,
      square_hd: 0.22,
      portrait_16_9: 0.17,
      landscape_16_9: 0.16,
      custom: 0.15,
      auto: 0.22,
    },
    currency: 'USD',
    notes: 'Fal pricing varies by quality and image_size: 1024x768 costs $0.01/$0.04/$0.15, while 3840x2160 costs $0.02/$0.11/$0.41 for Low/Medium/High.',
  },
  updatedAt: '2026-04-23T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'fal.ai',
    modelSlug: 'openai/gpt-image-2',
  },
  availability: 'available',
  brandId: 'openai',
};

const RAW_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'sora-2',
    modelSlug: 'sora-2',
    marketingName: 'OpenAI Sora 2',
    cardTitle: 'Sora 2',
    provider: 'OpenAI',
    brandId: 'openai',
    family: 'sora',
    versionLabel: '2',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: SORA_2_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/sora-2/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['720p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/sora-2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['720p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          acceptsImageFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
          audioToggle: false,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/sora-2/text-to-video',
    seo: {
      title: 'Sora 2 – Generate AI Videos from Text or Image with Sound',
      description:
        'Create rich AI-generated videos from text or image prompts using Sora 2. Native voice-over, ambient effects, and motion sync via MaxVideoAI.',
      canonicalPath: '/models/sora-2',
    },
    type: 'Text + Image',
    seoText:
      'Generate videos from text or images using Sora 2 — now with voice-over, ambient sound, and smooth animation. Animate reference stills or craft full prompts with synced audio.',
    demoUrl: 'https://v3b.fal.media/files/b/elephant/ch7vRQJfqfY__OPr6sl6Z_output.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/elephant/ch7vRQJfqfY__OPr6sl6Z_output.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
      altText: 'Sora 2 demo: Director in creative studio beside AI monitors',
    },
    prompts: [
      {
        title: 'Storm-lit knowledge vault',
        prompt:
          "A glowing library in the middle of a stormy ocean, books flying above crashing waves, camera pans upward to reveal lightning streaks, soft orchestral music with a warm voice-over narrating, 'Knowledge survives everything.'",
        mode: 't2v',
      },
      {
        title: 'Remix from still',
        prompt: 'Animate the uploaded concept art into a slow motion hero shot, dramatic particles and volumetric lighting',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'Can I access Sora 2 from Europe?',
        answer: 'Yes. MaxVideoAI brokers access so European teams can render without waiting on an OpenAI invite.',
      },
      {
        question: 'Do Sora 2 renders include a watermark?',
        answer: 'No. Outputs are delivered clean, ready for editing and distribution.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 208,
      durationSeconds: 4,
      resolution: '720p',
      label: 'Audio on',
    },
    promptExample:
      "A glowing tree in the middle of the desert, soft piano in background, camera slowly zooms out, cinematic lighting, voice-over: 'This is where hope begins.'",
  },
  {
    id: 'sora-2-pro',
    modelSlug: 'sora-2-pro',
    marketingName: 'OpenAI Sora 2 Pro',
    cardTitle: 'Sora 2 Pro',
    provider: 'OpenAI',
    brandId: 'openai',
    family: 'sora',
    versionLabel: 'Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: SORA_2_PRO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/sora-2/text-to-video/pro',
        ui: {
          modes: ['t2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Audio is enabled by default for lip-sync and ambience. Disable it if you only need silent motion.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/sora-2/image-to-video/pro',
        ui: {
          modes: ['i2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['auto', '720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          acceptsImageFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
          maxUploadMB: 75,
          audioToggle: true,
          notes: 'Upload a detailed still to preserve subject fidelity. Pro keeps dialogue in sync from the reference frame.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/sora-2/text-to-video/pro',
    seo: {
      title: 'Sora 2 Pro – Longer AI Videos with Audio & Enhanced Prompt Control',
      description:
        'Create longer, more immersive AI videos from text or images using Sora 2 Pro. Native voice, ambient sound, prompt chaining, and advanced control via MaxVideoAI.',
      canonicalPath: '/models/sora-2-pro',
    },
    type: 'Text + Image',
    seoText:
      'Generate longer AI videos with sound and scene control using Sora 2 Pro. Perfect for storytelling, explainers, and branded motion design—starting from image or text prompts.',
    demoUrl: 'https://v3b.fal.media/files/b/elephant/ch7vRQJfqfY__OPr6sl6Z_output.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/elephant/ch7vRQJfqfY__OPr6sl6Z_output.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
      altText: 'Sora 2 Pro demo: director alongside AI preview screens',
    },
    prompts: [
      {
        title: 'Multi-scene legend opener',
        prompt:
          "Scene 1 → A medieval city under the stars, camera slowly pans above rooftops, lute music plays, voice-over: 'Peace reigned for a century.' → Scene 2 → A rider gallops across the plains at sunrise, orchestral swell, zoom-in to sword hilt glowing.",
        mode: 't2v',
        notes: 'Use multi-prompt chaining to stitch scenes together in a single render.',
      },
      {
        title: 'Torchlit discovery',
        prompt:
          "Scene 1 → Interior of a jungle temple at dusk, drums echo in the background, voice-over: 'Legends speak of a guardian.' → Scene 2 → Torchlit hallway, camera glides toward ancient glyphs as the music builds.",
        mode: 'i2v',
        notes: 'Start from a detailed concept still to keep glyphs and lighting consistent.',
      },
    ],
    faqs: [
      {
        question: 'Does Sora 2 Pro always output audio?',
        answer:
          'Audio is on by default for lip-sync and sound design, but you can toggle it off in the composer if you only need visuals.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 480,
      durationSeconds: 8,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      "Scene 1 → A jungle temple at dusk, drums in the background, voice-over: 'Legends speak of a guardian.' → Scene 2 → A torchlit hallway, camera zooms into mysterious glyphs.",
  },
  {
    id: 'veo-3-1',
    modelSlug: 'veo-3-1',
    marketingName: 'Google Veo 3.1',
    cardTitle: 'Veo 3.1',
    provider: 'Google',
    brandId: 'google-veo',
    family: 'veo',
    versionLabel: '3.1',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: VEO_3_1_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/veo3.1',
        ui: {
          modes: ['t2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
          notes: 'Animate a single still while keeping the prompt and optional native audio aligned to one source image.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: 'fal-ai/veo3.1/reference-to-video',
        ui: {
          modes: ['ref2v'],
          duration: { options: ['8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
          notes: 'Attach multiple stills to preserve identity, styling, and wardrobe across the full shot.',
        },
      },
      {
        mode: 'fl2v',
        falModelId: 'fal-ai/veo3.1/first-last-frame-to-video',
        ui: {
          modes: ['fl2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16', '1:1'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
          notes: 'Bridge two keyframes with Veo 3.1 while the prompt defines motion, pacing, and camera path.',
        },
      },
      {
        mode: 'extend',
        falModelId: 'fal-ai/veo3.1/extend-video',
        ui: {
          modes: ['extend'],
          duration: { min: 1, default: 5 },
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Extend an existing Veo 3.1 clip from a source render without switching engines.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1',
    seo: {
      title: 'Veo 3.1 – Text, Start Image, References & Extend Video',
      description:
        'Generate cinematic Veo 3.1 videos with text prompts, start-image animation, multi-reference guidance, optional last-frame control, and extend workflows in one unified MaxVideoAI model page.',
      canonicalPath: '/models/veo-3-1',
    },
    type: 'Text, start image, references, last frame, extend',
    seoText:
      'Veo 3.1 on MaxVideoAI unifies text prompts, single start-image animation, multi-reference guidance, optional last-frame control, and video extension in one coherent workflow with optional native audio.',
    demoUrl: 'https://v3b.fal.media/files/b/kangaroo/oUCiZjQwEy6bIQdPUSLDF_output.mp4',
    media: {
      videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4',
      imagePath: '/hero/veo-3-1-hero.jpg',
      altText: 'Demo video generated with Veo 3.1',
    },
    prompts: [
      {
        title: 'Scripted hero read',
        prompt: 'Two person street interview in New York City.\nSample dialogue:\nHost: “Did you hear the news?”\nPerson: “Yes, Veo 3.1 text-to-video just landed inside MaxVideoAI.”\nCinematic handheld camera, rich ambient audio, confident VO tone.',
        mode: 't2v',
      },
      {
        title: 'Reference fidelity shot',
        prompt: 'Eight second tracking shot of the hero walking through neon city streets, maintain wardrobe and face from reference stills, cinematic lighting',
        mode: 'ref2v',
        notes: 'Attach 2 to 4 stills via Reference images to lock identity.',
      },
      {
        title: 'First to last bridge',
        prompt: 'Bridge from a glossy studio beauty shot to a warm lifestyle table scene in one fluid motion, preserve product silhouette and reflections, optional narrator line.',
        mode: 'fl2v',
        notes: 'Upload the opening and closing frames to steer the transition precisely.',
      },
    ],
    faqs: [
      {
        question: 'Does Veo 3 ship with the latest motion tuning?',
        answer: 'Yes. MaxVideoAI syncs routing with Google DeepMind updates so motion tuning stays current without manual work.',
      },
      {
        question: 'Can I use more than one image with Veo 3.1?',
        answer:
          'Yes. Use Reference mode for multiple stills, Generate Video with a single start image, or add a Last frame when you need to steer the ending.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 440,
      durationSeconds: 8,
      resolution: '1080p',
    },
  },
  {
    id: 'veo-3-1-fast',
    modelSlug: 'veo-3-1-fast',
    marketingName: 'Google Veo 3.1 Fast',
    cardTitle: 'Veo 3.1 Fast',
    provider: 'Google',
    brandId: 'google-veo',
    family: 'veo',
    versionLabel: '3.1 Fast',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: VEO_3_1_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/veo3.1/fast',
        ui: {
          modes: ['t2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/fast/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
          notes: 'Animate one still quickly while keeping Veo Fast native audio optional.',
        },
      },
      {
        mode: 'fl2v',
        falModelId: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
        ui: {
          modes: ['fl2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16', '1:1'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
          notes: 'Use two keyframes for faster start-to-end bridging while keeping Veo Fast pricing and latency.',
        },
      },
      {
        mode: 'extend',
        falModelId: 'fal-ai/veo3.1/fast/extend-video',
        ui: {
          modes: ['extend'],
          duration: { min: 1, default: 5 },
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Extend an existing Veo 3.1 Fast clip without leaving the Fast workflow.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/fast',
    seo: {
      title: 'Veo 3.1 Fast – Text, Start Image, Last Frame & Extend Video',
      description:
        'Use Veo 3.1 Fast for affordable text prompts, start-image animation, optional last-frame control, and extend workflows with optional native audio inside one unified MaxVideoAI model page.',
      canonicalPath: '/models/veo-3-1-fast',
    },
    type: 'Text, start image, last frame, extend',
    seoText:
      'Veo 3.1 Fast keeps quick prompt iteration, single start-image animation, optional last-frame control, and extend-video workflows inside one lower-cost DeepMind route with optional audio.',
    demoUrl: '/hero/veo3.mp4',
    media: {
      videoUrl: '/hero/veo3.mp4',
      imagePath: '/hero/veo-3-1-hero.jpg',
      altText: 'Fast rendering sample with Veo 3.1 Fast',
    },
    prompts: [
      {
        title: 'Street interview',
        prompt: 'Casual street interview on a busy sidewalk, handheld camera, native dialogue: “Have you seen Veo 3.1 Fast inside MaxVideoAI?”',
        mode: 't2v',
      },
      {
        title: 'Misty forest zoom',
        prompt: 'Animate a still of a misty forest at dawn, slow zoom toward a mossy rock as sun rays pierce the trees, optional ambient birdsong.',
        mode: 'i2v',
        notes: 'Upload a single start image and enable audio for subtle ambience or leave it off for silent loops.',
      },
      {
        title: 'Storyboard bridge',
        prompt: 'Animate between a rough opening storyboard panel and a polished final composition, camera pushes forward, preserve character blocking and reveal timing.',
        mode: 'fl2v',
        notes: 'Use two keyframes when you need speed and tighter transition control.',
      },
    ],
    faqs: [
      {
        question: 'Does Veo 3 ship with the latest motion tuning?',
        answer: 'Yes. MaxVideoAI syncs routing with Google DeepMind updates so motion tuning stays current without manual work.',
      },
      {
        question: 'Does Veo 3.1 Fast support first and last frames?',
        answer:
          'Yes. In Generate Video, upload a start image and add a Last frame when you want to steer the ending.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 120,
      durationSeconds: 8,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'A person walking alone on a bridge at night, city lights in the background, camera tracks from behind, ambient street noise',
  },
  {
    id: 'veo-3-1-lite',
    modelSlug: 'veo-3-1-lite',
    marketingName: 'Google Veo 3.1 Lite',
    cardTitle: 'Veo 3.1 Lite',
    provider: 'Google',
    brandId: 'google-veo',
    family: 'veo',
    versionLabel: '3.1 Lite',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: VEO_3_1_LITE_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/veo3.1/lite',
        ui: {
          modes: ['t2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/lite/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: false,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 8,
          notes: 'Animate one still with Veo 3.1 Lite. Audio is always included, and 1080p requires an 8 second render.',
        },
      },
      {
        mode: 'fl2v',
        falModelId: 'fal-ai/veo3.1/lite/first-last-frame-to-video',
        ui: {
          modes: ['fl2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: false,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 8,
          notes: 'Bridge two keyframes inside Lite when you need a guided ending. Audio is always generated, and 1080p requires 8 seconds.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/lite',
    seo: {
      title: 'Veo 3.1 Lite – Text, Start Image & First/Last Video',
      description:
        'Use Veo 3.1 Lite for lower-cost text prompts, start-image animation, and optional first/last-frame control with always-on native audio inside one unified MaxVideoAI model page.',
      canonicalPath: '/models/veo-3-1-lite',
    },
    type: 'Text, start image, last frame',
    seoText:
      'Veo 3.1 Lite keeps the unified Veo workflow on MaxVideoAI for text prompts, single start-image animation, and optional first/last-frame control, with native audio always included and lower-cost 720p or 1080p pricing.',
    demoUrl: 'https://v3b.fal.media/files/b/0a946880/sfDxO-znDhQthS00Pa2Ns_d99979ba04614c3d963ebaa342627b3c.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a946880/sfDxO-znDhQthS00Pa2Ns_d99979ba04614c3d963ebaa342627b3c.mp4',
      imagePath: '/hero/veo-3-1-hero.jpg',
      altText: 'Demo video generated with Veo 3.1 Lite',
    },
    prompts: [
      {
        title: 'Fast social hook',
        prompt: 'A late-night ramen counter in Tokyo, soft steam drifting upward, quick handheld push toward the chef plating one bowl, ambient street chatter and kitchen sound.',
        mode: 't2v',
      },
      {
        title: 'Start-image motion test',
        prompt: 'Animate this still into a clean 8 second push-in with restrained subject motion, keep the palette grounded and the soundtrack subtle.',
        mode: 'i2v',
        notes: 'Use one start image when you want lower-cost motion tests before moving to Veo 3.1 or Veo 3.1 Fast.',
      },
      {
        title: 'Keyframe bridge',
        prompt: 'Bridge from the approved packshot to the final lifestyle frame in one smooth motion, keep product silhouette stable and reveal the wider scene gradually.',
        mode: 'fl2v',
        notes: 'Add a Last frame in Generate Video to steer the ending without switching engines.',
      },
    ],
    faqs: [
      {
        question: 'What workflows are available in Veo 3.1 Lite?',
        answer:
          'Veo 3.1 Lite supports text-to-video, start-image animation, and first/last-frame transitions. Multi-reference stills and extend workflows remain reserved for other Veo tiers.',
      },
      {
        question: 'Can I disable audio in Veo 3.1 Lite?',
        answer: 'No. Fal exposes Veo 3.1 Lite with native audio always on, so MaxVideoAI keeps audio locked on for this tier.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 40,
      durationSeconds: 8,
      resolution: '720p',
      label: 'Audio always on',
    },
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: true,
        includeInFamilyCopy: true,
      },
      compare: {
        suggestOpponents: ['veo-3-1-fast', 'veo-3-1', 'ltx-2-fast'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 4,
        variantGroup: 'veo-3-1',
        variantLabel: 'Lite',
      },
      pricing: {
        includeInEstimator: true,
      },
    },
    promptExample:
      'A cozy bakery kitchen at sunrise, soft dolly-in, flour dust in the light, baker plating one pastry, natural ambience and room tone.',
  },
  {
    id: 'lumaRay2',
    modelSlug: 'luma-ray-2',
    marketingName: 'Luma Ray 2',
    cardTitle: 'Ray 2',
    provider: 'Luma AI',
    brandId: 'luma',
    family: 'luma',
    versionLabel: 'Ray 2',
    availability: 'available',
    logoPolicy: 'logoAllowed',
    engine: LUMA_RAY2_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2',
        ui: {
          modes: ['t2v'],
          duration: { options: ['5s', '9s'], default: '5s' },
          resolution: ['540p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['5s', '9s'], default: '5s' },
          resolution: ['540p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 10,
          audioToggle: false,
          notes: 'Animate one still with optional end-frame guidance and loop control.',
        },
      },
      {
        mode: 'v2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2/modify',
        ui: {
          modes: ['v2v'],
          notes: 'Modify a source clip with optional prompt and reference-image guidance plus Fal adherence presets.',
        },
      },
      {
        mode: 'reframe',
        falModelId: 'fal-ai/luma-dream-machine/ray-2/reframe',
        ui: {
          modes: ['reframe'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
          notes: 'Reframe an existing source clip into a new aspect ratio with optional prompt, reference image, and crop controls.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/luma-dream-machine/ray-2',
    seo: {
      title: 'Luma Ray 2 – Generate, Modify and Reframe AI Video',
      description:
        'Use Luma Ray 2 for cinematic text-to-video, image-to-video, modify, and reframe workflows with 5 s or 9 s generation shots, up to 1080p output, source-video editing, and reframing tools inside MaxVideoAI.',
      canonicalPath: '/models/luma-ray-2',
    },
    type: 'Text, image, modify, reframe',
    seoText:
      'Luma Ray 2 on MaxVideoAI combines cinematic text generation, still-to-video, source-video modification, and reframe workflows in one unified model page, with 540p to 1080p generation outputs plus dedicated edit controls.',
    demoUrl: '/hero/luma-dream.mp4',
    media: {
      videoUrl: '/hero/luma-dream.mp4',
      imagePath: '/hero/luma-dream.jpg',
      altText: 'Cinematic demo render from Luma Ray 2',
    },
    prompts: [
      {
        title: 'Night tram sequence',
        prompt:
          'Rain-soaked European tram gliding through a neon city at blue hour, cinematic reflections on cobblestones, slow tracking camera, controlled filmic motion.',
        mode: 't2v',
      },
      {
        title: 'Fashion still to motion',
        prompt:
          'Animate the uploaded fashion editorial still into a subtle forward dolly, fabric movement and soft hair motion, preserve facial identity and studio lighting.',
        mode: 'i2v',
        notes: 'Add an end frame when you need tighter closing composition control.',
      },
      {
        title: 'Looping product orbit',
        prompt:
          'Luxury fragrance bottle on black glass, smooth orbiting camera, precise highlight roll-off, seamless loop that returns naturally to the opening pose.',
        mode: 't2v',
      },
      {
        title: 'Wardrobe-aware modify pass',
        prompt:
          'Modify the uploaded runway clip to keep the subject centered while refreshing the wardrobe texture to metallic silk, preserve camera move and pacing, flex_2.',
        mode: 'v2v',
        notes: 'Upload a source video, then choose a Modify strength preset from adhere to reimagine.',
      },
      {
        title: 'Vertical reframe for social',
        prompt:
          'Reframe the uploaded landscape fashion clip into a clean 9:16 vertical crop, keep the face and shoulders prioritized, maintain motion continuity.',
        mode: 'reframe',
      },
    ],
    faqs: [
      {
        question: 'What workflows does Luma Ray 2 expose in MaxVideoAI?',
        answer:
          'Ray 2 now keeps the full public Fal surface inside one model page: text-to-video, image-to-video, modify, and reframe.',
      },
      {
        question: 'Which options are exposed per workflow?',
        answer:
          'Generate modes keep 5 s or 9 s duration, 540p to 1080p, cinematic aspect ratios, optional loop, and optional end image for image-driven shots. Modify adds Fal adherence presets, and Reframe adds new aspect-ratio plus crop-window controls on a source clip.',
      },
    ],
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: true,
        includeInFamilyCopy: true,
      },
      compare: {
        suggestOpponents: ['veo-3-1-fast', 'kling-3-standard', 'seedance-1-5-pro'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 5,
        variantGroup: 'luma-ray-2',
        variantLabel: 'Ray 2',
      },
      pricing: {
        includeInEstimator: false,
      },
    },
    promptExample:
      'Elegant dolly shot through a boutique hotel lobby at dusk, warm practical lighting, reflective marble floor, cinematic motion with restrained pacing.',
  },
  {
    id: 'lumaRay2_flash',
    modelSlug: 'luma-ray-2-flash',
    marketingName: 'Luma Ray 2 Flash',
    cardTitle: 'Ray 2 Flash',
    provider: 'Luma AI',
    brandId: 'luma',
    family: 'luma',
    versionLabel: 'Ray 2 Flash',
    availability: 'available',
    logoPolicy: 'logoAllowed',
    engine: LUMA_RAY2_FLASH_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash',
        ui: {
          modes: ['t2v'],
          duration: { options: ['5s', '9s'], default: '5s' },
          resolution: ['540p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['5s', '9s'], default: '5s' },
          resolution: ['540p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 10,
          audioToggle: false,
          notes: 'Use Flash for faster cinematic drafts with the same visible settings surface.',
        },
      },
      {
        mode: 'v2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash/modify',
        ui: {
          modes: ['v2v'],
          notes: 'Modify a source clip quickly with the same Fal adherence and reimagination presets exposed in Flash.',
        },
      },
      {
        mode: 'reframe',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash/reframe',
        ui: {
          modes: ['reframe'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
          notes: 'Reframe an existing source clip into a new format with the faster Flash variant.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/luma-dream-machine/ray-2-flash',
    seo: {
      title: 'Luma Ray 2 Flash – Faster Generate, Modify and Reframe Workflows',
      description:
        'Use Luma Ray 2 Flash for quicker text-to-video, image-to-video, modify, and reframe iterations with the same Ray 2 workflow family, 5 s or 9 s generation shots, and faster source-video editing.',
      canonicalPath: '/models/luma-ray-2-flash',
    },
    type: 'Text, image, modify, reframe',
    seoText:
      'Luma Ray 2 Flash keeps the full Ray 2 workflow surface aligned while prioritizing quicker turnarounds for cinematic drafts, source-video modification, vertical reframes, and reference animation.',
    demoUrl: '/hero/luma-ray2-flash.mp4',
    media: {
      videoUrl: '/hero/luma-ray2-flash.mp4',
      imagePath: '/hero/luma-ray2-flash.jpg',
      altText: 'Fast draft render from Luma Ray 2 Flash',
    },
    prompts: [
      {
        title: 'Fast concept tease',
        prompt:
          'Futuristic sports car reveal in a narrow tunnel, quick cinematic push-in, wet asphalt reflections, bold contrast, energetic but stable motion.',
        mode: 't2v',
      },
      {
        title: 'Storyboard animatic',
        prompt:
          'Animate the uploaded storyboard frame into a fast previs shot with clear subject motion, camera parallax, and readable lighting transitions.',
        mode: 'i2v',
        notes: 'Best suited to rapid iteration before switching the approved shot to Ray 2.',
      },
      {
        title: 'Fast modify iteration',
        prompt:
          'Modify the uploaded product video into a cleaner showroom look, preserve the camera path and timing, flex_1.',
        mode: 'v2v',
      },
      {
        title: 'Social crop reframe',
        prompt:
          'Reframe the uploaded horizontal teaser into a 9:16 social crop with the product kept in the upper-center third throughout the move.',
        mode: 'reframe',
      },
    ],
    faqs: [
      {
        question: 'Why keep Ray 2 and Ray 2 Flash as the only public Luma models?',
        answer:
          'The family stays simple at the model level, but each model now exposes the real Fal workflows inside it: generate, modify, and reframe.',
      },
      {
        question: 'Does Flash use a different pricing path?',
        answer:
          'Yes. Flash keeps its own pricing path for generate, modify, and reframe workflows, while still allowing environment overrides when you want to tune the rollout.',
      },
    ],
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: true,
        includeInFamilyCopy: true,
      },
      compare: {
        suggestOpponents: ['luma-ray-2', 'veo-3-1-lite', 'ltx-2-3-fast'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 6,
        variantGroup: 'luma-ray-2',
        variantLabel: 'Ray 2 Flash',
      },
      pricing: {
        includeInEstimator: false,
      },
    },
    promptExample:
      'Moody concept trailer shot of a lone motorcyclist entering a foggy tunnel, fast turnaround, cinematic highlights, clear subject silhouette.',
  },
  {
    id: 'pika-text-to-video',
    modelSlug: 'pika-text-to-video',
    marketingName: 'Pika 2.2 Text & Image to Video',
    cardTitle: 'Pika 2.2',
    provider: 'Pika',
    brandId: 'pika',
    family: 'pika',
    versionLabel: '2.2',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: PIKA_TEXT_TO_VIDEO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/pika/v2.2/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/pika/v2.2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 25,
          audioToggle: false,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/pika/v2.2/text-to-video',
    seo: {
      title: 'Pika 2.2 – Stylized Text & Image to Video',
      description:
        'Generate stylized AI video from prompts or animate uploaded stills using Pika 2.2. Perfect for short-form loops without audio via MaxVideoAI.',
      canonicalPath: '/models/pika-text-to-video',
    },
    type: 'textImage',
    seoText:
      'Create fast, fun, stylized AI videos with Pika. Ideal for 5–10 second animations in vertical or square formats—no audio, fast rendering, high visual impact.',
    demoUrl: 'https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4',
    media: {
      videoUrl: 'https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4',
      imagePath: '/hero/pika-22.jpg',
      altText: 'Stylized short clip made with Pika 2.2',
    },
    prompts: [
      {
        title: 'Pixel cat portal hop',
        prompt: 'A pixel-art cat jumping through portals, retro arcade backdrop, rainbow glitch trails, snappy 2D animation',
        mode: 't2v',
      },
      {
        title: 'Comic pop intro',
        prompt: 'Comic-book style splash screen with bold text bursts, camera punch-in, bright halftone textures',
        mode: 't2v',
      },
      {
        title: 'Animate a sketch',
        prompt: 'Animate the uploaded storyboard still into a sweeping camera move, add parallax and light leaks',
        mode: 'i2v',
        notes: 'Upload a still frame under Reference images to drive the animation.',
      },
    ],
    faqs: [
      {
        question: 'Can I create both 9:16 and 16:9 clips with Pika 2.2?',
        answer: 'Yes. Select your aspect ratio before queuing and the render will match without extra tooling.',
      },
      {
        question: 'Does Pika 2.2 include audio?',
        answer: 'Base renders are silent. Layer audio afterwards in MaxVideoAI using the soundtrack add-on.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 30,
      durationSeconds: 5,
      resolution: '720p',
      label: 'Silent clip',
    },
    promptExample:
      'A cartoon astronaut floating through candy space, bubble gum planets, comic-book animation style',
  },
  {
    id: 'kling-2-5-turbo',
    modelSlug: 'kling-2-5-turbo',
    marketingName: 'Kling 2.5 Turbo',
    cardTitle: 'Kling 2.5 Turbo',
    provider: 'Kling by Kuaishou',
    brandId: 'kling',
    family: 'kling',
    versionLabel: '2.5 Turbo',
    availability: 'available',
    logoPolicy: 'textOnly',
    isLegacy: true,
    engine: KLING_2_5_TURBO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['1080p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['1080p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Pro image mode keeps the cinematic motion plan.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video',
        ui: {
          modes: ['i2i'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['1080p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Standard mode trades a touch of polish for lower cost.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video',
    seo: {
      title: 'Kling 2.5 Turbo – Text & Image to Video on MaxVideoAI',
      description:
        'Route cinematic Kling 2.5 Turbo shots through MaxVideoAI with instant switching between Pro text, Pro image, and Standard budget tiers.',
      canonicalPath: '/models/kling-2-5-turbo',
    },
    type: 'textImage',
    seoText:
      'Bring Kuaishou’s Kling engine into the same prompt lab you already use for Sora and Veo. Flip between Pro text runs, high-fidelity image animatics, or the Standard tier for rapid TikTok loops without changing cards.',
    demoUrl: 'https://storage.googleapis.com/falserverless/model_tests/kling/kling-v2.5-turbo-pro-text-to-video-output.mp4',
    media: {
      videoUrl: 'https://storage.googleapis.com/falserverless/model_tests/kling/kling-v2.5-turbo-pro-text-to-video-output.mp4',
      imagePath: '/hero/kling-25.jpg',
      altText: 'Cinematic street scene rendered with Kling 2.5 Turbo',
    },
    prompts: [
      {
        title: 'Cinematic racing spot',
        prompt:
          'A stark starting line divides two performance cars, engines revving, cinematic lighting, camera sweeps overhead into a macro badge close-up.',
        mode: 't2v',
      },
      {
        title: 'Hero portrait remix (Pro)',
        prompt:
          'Animate the uploaded portrait into a dreamy slow-motion push-in, volumetric shafts of light, shallow depth of field, 35mm lens.',
        mode: 'i2v',
        notes: 'Use Pro image mode when you need the crispest detail.',
      },
      {
        title: 'Standard tier mood loop',
        prompt: 'Looping handheld shot of neon signage flickering in the rain, stylized color grading, subtle camera sway.',
        mode: 'i2i',
        notes: 'Perfect when you need fast ambient loops at lower spend.',
      },
    ],
    faqs: [
      {
        question: 'What’s the difference between Pro and Standard image modes?',
        answer:
          'Pro image mode sticks closest to the prompt with richer motion and texture, while Standard image mode runs faster and cheaper for social-first loops. Both live inside the same Kling card so you can swap per render.',
      },
      {
        question: 'Does Kling generate audio?',
        answer:
          'Kling 2.5 Turbo outputs silent MP4 files. Layer VO or music afterwards in MaxVideoAI or route the brief through Sora 2 Pro if you need narration baked in.',
      },
      {
        question: 'Can I tweak CFG scale?',
        answer:
          'Yes. Lower values loosen the guidance for more abstract motion, while higher values stay literal to your brief. The default 0.5 works well for most cinematic shots.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 35,
      durationSeconds: 5,
      label: 'Pro text or image (5s clip)',
    },
    promptExample:
      'Gimbal push-in on a dancer under warm spotlight, fog in the air, 24fps, cinematic depth-of-field, shimmering wardrobe.',
  },
  {
    id: 'kling-2-6-pro',
    modelSlug: 'kling-2-6-pro',
    marketingName: 'Kling 2.6 Pro',
    cardTitle: 'Kling 2.6 Pro – Cinematic video with native audio',
    provider: 'Kling by Kuaishou',
    brandId: 'kling',
    family: 'kling',
    versionLabel: 'v2.6 Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    isLegacy: true,
    engine: KLING_2_6_PRO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/kling-video/v2.6/pro/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          notes: 'Native audio on by default; toggle off if you need silent renders.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/kling-video/v2.6/pro/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload one reference still; Kling keeps detail and syncs audio.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/kling-video/v2.6/pro/text-to-video',
    seo: {
      title: 'Kling 2.6 Pro AI Video – Text & Image to Video with Native Audio | MaxVideoAI',
      description:
        'Generate cinematic AI videos with Kling 2.6 Pro. Text and image to video with fluid motion, rich details, and native audio, ideal for social content, ads, and storytelling.',
      canonicalPath: '/models/kling-2-6-pro',
    },
    type: 'textImage',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a8500c6/RZ0L5FqW2FFFnCnpcYYDV_output.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4db8923c-6762-47af-a0bd-5d50c28842f6-job_45f1fe48-ed93-452d-819b-9b956cd2d489.jpg',
      altText: 'Kling 2.6 Pro render: futuristic duel with glowing energy blades',
    },
    prompts: [
      {
        title: 'Hangar duel with native dialogue',
        prompt:
          '10-second 16:9 cinematic shot in a futuristic hangar. Two armored fighters wield glowing blades, camera circles them on a wet metal floor, sparks fly at each clash, alarm + engine rumble underscore the exchange “You don’t have to do this.” / “You left me behind.”',
        mode: 't2v',
      },
      {
        title: 'Frontline laughter – WWI truck',
        prompt:
          '8–10s shot of two young soldiers riding the back of a muddy World War I truck, laughing as the camera bumps from a wide rear view into a medium close. Soft overcast light, distant artillery booms, truck rumble, heartfelt dialogue about opening a café after the war.',
        mode: 't2v',
      },
      {
        title: 'Rainy café moment (vertical)',
        prompt:
          '9:16 cozy coffee shop scene at night. Medium push-in over a laptop as a woman looks up, takes a breath, and says “Okay… let’s do this.” Soft lo-fi music, gentle rain on the window, warm tungsten interior vs cool street reflections.',
        mode: 't2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 70,
      durationSeconds: 5,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'Two friends walk through a rain-soaked neon alley, camera tracks at shoulder height, reflective puddles, soft thunder, quiet dialogue: “Did you get the shot?” “Yeah, Kling 2.6 nailed it.”',
  },
  {
    id: 'kling-3-pro',
    modelSlug: 'kling-3-pro',
    marketingName: 'Kling 3 Pro',
    cardTitle: 'Kling 3 Pro – Multi-prompt cinematic control',
    provider: 'Kling by Kuaishou',
    brandId: 'kling',
    family: 'kling',
    versionLabel: 'v3 Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: KLING_3_PRO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/kling-video/v3/pro/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 },
          resolution: ['1080p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          notes: 'Multi-prompt sequencing supported; audio on by default.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/kling-video/v3/pro/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 },
          resolution: ['1080p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Add end frames or elements for tighter motion control.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/kling-video/v3/pro/text-to-video',
    seo: {
      title: 'Kling 3 Pro – Multi-prompt Text & Image to Video | MaxVideoAI',
      description:
        'Direct Kling 3 Pro renders with multi-prompt sequencing, element references, and voice controls. Generate cinematic 3–15s clips in 1080p.',
      canonicalPath: '/models/kling-3-pro',
    },
    type: 'textImage',
    seoText:
      'Kling 3 Pro brings scene-level prompting, element references, and voice control to longer cinematic clips. Build multi-shot sequences with native audio from one workspace.',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a8500c6/RZ0L5FqW2FFFnCnpcYYDV_output.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4db8923c-6762-47af-a0bd-5d50c28842f6-job_45f1fe48-ed93-452d-819b-9b956cd2d489.jpg',
      altText: 'Kling 3 Pro render: cinematic duel with glowing energy blades',
    },
    prompts: [
      {
        title: 'Three-scene heist intro',
        prompt:
          'A cinematic 16:9 heist montage: Scene 1, wide night exterior of a museum with rain and neon reflections. Scene 2, close-up of gloved hands cracking a safe, sparks and ticking ambience. Scene 3, slow-motion escape on a rooftop with sirens and dramatic music.',
        mode: 't2v',
      },
      {
        title: 'Fashion lookbook motion',
        prompt:
          '9:16 fashion lookbook: model turns under soft studio lights, camera orbits to a profile close-up, fabric detail ripples, upbeat audio bed.',
        mode: 't2v',
      },
      {
        title: 'Animate a keyframe + end frame',
        prompt:
          'Animate the uploaded keyframe into a smooth dolly push, then resolve into the provided end frame with subtle lens flare and soft ambient audio.',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'Does Kling 3 Pro support multi-prompt sequences?',
        answer:
          'Yes. Use multi-prompt to chain scenes with per-scene durations up to the 15s cap.',
      },
      {
        question: 'What are elements used for?',
        answer:
          'Elements let you add frontal + reference images (and an optional reference video) to anchor characters or products during image-to-video runs.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 84,
      durationSeconds: 5,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'Scene 1: sunrise drone shot over a coastal town. Scene 2: close-up of a chef plating a dish. Scene 3: slow-motion toast on a rooftop, warm ambient audio.',
  },
  {
    id: 'kling-3-standard',
    modelSlug: 'kling-3-standard',
    marketingName: 'Kling 3 Standard',
    cardTitle: 'Kling 3 Standard – Multi-prompt at a lower rate',
    provider: 'Kling by Kuaishou',
    brandId: 'kling',
    family: 'kling',
    versionLabel: 'v3 Standard',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: KLING_3_STANDARD_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/kling-video/v3/standard/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 },
          resolution: ['1080p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          notes: 'Multi-prompt sequencing supported at Standard rates.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/kling-video/v3/standard/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 },
          resolution: ['1080p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Add end frames or elements for tighter motion control.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/kling-video/v3/standard/text-to-video',
    seo: {
      title: 'Kling 3 Standard – Multi-prompt Text & Image to Video | MaxVideoAI',
      description:
        'Use Kling 3 Standard for multi-prompt sequences, element references, and voice controls at a lower $/s rate in 1080p.',
      canonicalPath: '/models/kling-3-standard',
    },
    type: 'textImage',
    seoText:
      'Kling 3 Standard brings scene-level prompting and element references to longer clips with a lower per-second price. Perfect for multi-shot testing and story beats.',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a8500c6/RZ0L5FqW2FFFnCnpcYYDV_output.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4db8923c-6762-47af-a0bd-5d50c28842f6-job_45f1fe48-ed93-452d-819b-9b956cd2d489.jpg',
      altText: 'Kling 3 Standard render: cinematic duel with glowing energy blades',
    },
    prompts: [
      {
        title: 'Multi-scene travel cut',
        prompt:
          'Scene 1: sunrise over a foggy mountain ridge. Scene 2: wide shot of hikers crossing a suspension bridge. Scene 3: close-up of a camera capturing golden-hour portraits.',
        mode: 't2v',
      },
      {
        title: 'Product hero sequence',
        prompt:
          'Scene 1: macro of a luxury watch face, shallow depth of field. Scene 2: rotating hero shot with rim light. Scene 3: wrist-on model, soft ambient audio.',
        mode: 't2v',
      },
      {
        title: 'Animate a reference + end frame',
        prompt:
          'Animate the uploaded reference into a smooth dolly push and resolve into the provided end frame, soft ambient audio bed.',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'What’s the difference between Kling 3 Standard and Pro?',
        answer:
          'Standard offers the same multi-prompt and element controls at a lower price point; Pro prioritizes premium fidelity.',
      },
      {
        question: 'Does Standard support voice control?',
        answer:
          'Yes, you can specify voice IDs for voice control with a small per-second add-on.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 63,
      durationSeconds: 5,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'Scene 1: wide city skyline at dusk. Scene 2: close-up of neon reflections in rain. Scene 3: slow-motion walk through the alley, ambient audio.',
  },
  {
    id: 'kling-3-4k',
    modelSlug: 'kling-3-4k',
    marketingName: 'Kling 3 4K',
    cardTitle: 'Kling 3 4K - Native 4K video output',
    provider: 'Kling by Kuaishou',
    brandId: 'kling',
    family: 'kling',
    versionLabel: 'v3 4K',
    availability: 'available',
    logoPolicy: 'textOnly',
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: true,
        includeInFamilyCopy: true,
      },
      compare: {
        suggestOpponents: ['kling-3-pro', 'veo-3-1', 'sora-2-pro'],
        publishedPairs: ['kling-3-pro', 'kling-3-standard', 'veo-3-1', 'sora-2-pro'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        variantGroup: 'kling-3',
        variantLabel: '4K',
      },
      pricing: {
        includeInEstimator: true,
      },
    },
    engine: KLING_3_4K_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/kling-video/v3/4k/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 },
          resolution: ['4k'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          notes: 'Native 4K output in one step; use for final delivery renders.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/kling-video/v3/4k/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 },
          resolution: ['4k'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Animate a source frame directly to native 4K output.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/kling-video/v3/4k/text-to-video',
    seo: {
      title: 'Kling 3 4K - Native 4K Text & Image to Video | MaxVideoAI',
      description:
        'Generate native 4K Kling 3 videos from text or images. Use Kling 3 4K for final delivery renders with 3-15s clips and native audio.',
      canonicalPath: '/models/kling-3-4k',
    },
    type: 'textImage',
    seoText:
      'Kling 3 4K routes prompts and image-to-video jobs to native 4K output for delivery-grade cinematic clips without a separate upscale step.',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a97a910/Cqtl7vJrGsMBpq7Cxbkhs_output.mp4',
      imagePath: '/hero/kling-3-4k-hero.jpg',
      altText: 'Kling 3 4K native 4K product hero render',
    },
    prompts: [
      {
        title: '4K product reveal',
        prompt:
          'Native 4K cinematic product reveal: macro reflections across a polished device, slow dolly push, controlled studio lighting, crisp edges, subtle ambient audio.',
        mode: 't2v',
      },
      {
        title: 'Premium travel hero',
        prompt:
          '16:9 native 4K travel hero shot: sunrise over a cliffside hotel, smooth drone glide, warm haze, ocean spray, refined luxury campaign feel.',
        mode: 't2v',
      },
      {
        title: 'Animate source frame in 4K',
        prompt:
          'Animate the uploaded reference into a native 4K slow push-in with clean subject edges, stable lighting, and polished final-frame composition.',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'Is Kling 3 4K an upscale?',
        answer:
          'No. This route uses Kling native 4K endpoints, so the video is generated directly at 4K instead of upscaled after a 1080p render.',
      },
      {
        question: 'When should I use Kling 3 4K instead of Pro?',
        answer:
          'Use Kling 3 Pro for lower-cost creative iteration in 1080p, then move approved prompts or images to Kling 3 4K for final delivery renders.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 210,
      durationSeconds: 5,
      resolution: '4k',
      label: 'Native 4K',
    },
    promptExample:
      'Native 4K luxury car reveal at night, wet asphalt reflections, slow crane move, crisp body lines, restrained cinematic audio.',
  },
  {
    id: 'seedance-1-5-pro',
    modelSlug: 'seedance-1-5-pro',
    marketingName: 'Seedance 1.5 Pro',
    cardTitle: 'Seedance 1.5 Pro – cinematic motion control',
    provider: 'ByteDance',
    brandId: 'bytedance',
    family: 'seedance',
    versionLabel: 'v1.5 Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: SEEDANCE_1_5_PRO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [4, 5, 6, 7, 8, 9, 10, 11, 12], default: 5 },
          resolution: ['480p', '720p', '1080p'],
          aspectRatio: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          audioToggle: true,
          notes: 'Use camera fixed for locked cinematic motion.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/bytedance/seedance/v1.5/pro/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [4, 5, 6, 7, 8, 9, 10, 11, 12], default: 5 },
          resolution: ['480p', '720p', '1080p'],
          aspectRatio: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Add an end frame and lock the camera for smoother continuity.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/bytedance/seedance/v1.5/pro/text-to-video',
    seo: {
      title: 'Seedance 1.5 Pro – Cinematic Text & Image to Video | MaxVideoAI',
      description:
        'Generate Seedance 1.5 Pro clips with cinematic motion, camera lock, and native audio. Supports text-to-video or image-to-video up to 12s.',
      canonicalPath: '/models/seedance-1-5-pro',
    },
    type: 'textImage',
    seoText:
      'Seedance 1.5 Pro delivers cinematic motion, camera locking, and audio-ready renders with flexible aspect ratios and resolution tiers.',
    prompts: [
      {
        title: 'Locked camera city scene',
        prompt:
          'A moody 16:9 night street in light rain, neon reflections shimmering, camera locked and gentle ambience, subtle audio bed.',
        mode: 't2v',
      },
      {
        title: 'Animate with an end frame',
        prompt:
          'Animate the uploaded still into a slow push-in, then resolve into the provided end frame with soft ambient audio.',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'What does camera fixed do?',
        answer:
          'Camera fixed keeps the camera locked, ideal for stabilised shots and continuity.',
      },
      {
        question: 'Does Seedance support native audio?',
        answer:
          'Yes. Audio is on by default and can be disabled for lower pricing.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 26,
      durationSeconds: 5,
      resolution: '720p',
      label: 'Audio on',
    },
    surfaces: {
      compare: {
        includeInHub: true,
      },
    },
    promptExample:
      'Locked camera shot of a neon alley, subtle rain, soft ambient audio, slow motion detail.',
  },
  {
    id: 'seedance-2-0',
    modelSlug: 'seedance-2-0',
    marketingName: 'Seedance 2.0',
    cardTitle: 'Seedance 2.0',
    provider: 'ByteDance',
    brandId: 'bytedance',
    family: 'seedance',
    versionLabel: '2.0',
    availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
    logoPolicy: 'textOnly',
    billingNote: 'Seedance 2 uses Fal token pricing. Generate shows the active route, applies the MaxVideoAI margin, and rounds the quote up to the next cent before each run.',
    engine: SEEDANCE_2_0_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          audioToggle: true,
          notes: '4-15s or auto, 480p/720p, native audio on or off, with the wider Seedance 2 camera ratio set.',
        },
      },
      {
        mode: 'i2v',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.i2v,
        ui: {
          modes: ['i2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Start image plus optional end image, 4-15s or auto, 480p/720p, with audio on or off.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.ref2v,
        ui: {
          modes: ['ref2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Prompt-only is allowed, or add up to 9 images, 3 videos, and 3 audio files with 12 total references max.',
        },
      },
    ],
    defaultFalModelId: SEEDANCE_2_ENDPOINTS.standard.t2v,
    seo: {
      title: 'Seedance 2.0 — ByteDance AI Video with Native Audio and References',
      description:
        'Seedance 2.0 by ByteDance: cinematic AI video with native audio, realistic physics, director-level camera control, 480p/720p output, and text, image, and reference workflows.',
      canonicalPath: '/models/seedance-2-0',
    },
    type: 'textImage',
    seoText:
      'Seedance 2.0 supports text-to-video, image-to-video with optional end frame, and reference-to-video workflows with 480p/720p output, auto or 4-15 second durations, multimodal references, and native audio generation.',
    media: {
      videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Seedance-2-husband-coming-home.webm',
      imagePath: '/hero/seedance-2-0.jpg',
      altText: 'Seedance 2.0 demo frame showing a cinematic homecoming scene',
    },
    demoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Seedance-2-husband-coming-home.webm',
    prompts: [
      {
        title: 'Action chase test',
        prompt:
          'Cinematic rooftop chase at dusk, three shots with natural cuts, handheld tracking then crane reveal, synchronized footsteps and city ambience, 15 seconds total.',
        mode: 't2v',
      },
      {
        title: 'Storyboard reference run',
        prompt:
          'Use storyboard references to keep character wardrobe and location continuity across a 3-shot sequence, with dual-channel ambient audio and one dialogue line.',
        mode: 'i2v',
      },
      {
        title: 'Reference continuity pass',
        prompt:
          'Use six reference stills to keep one hero outfit and one city location consistent across a three-beat sequence, then add a soft ambience bed and one impact cue.',
        mode: 'ref2v',
      },
    ],
    faqs: [
      {
        question: 'What is Seedance 2.0 best for?',
        answer:
          'Use Seedance 2.0 for cinematic multi-shot timelines, stronger motion realism, and native audio-led outputs.',
      },
      {
        question: 'Which Seedance route family should I use first?',
        answer:
          'Start with text-to-video for prompt-led ideation, use image-to-video when you need a start frame or an optional end frame, and move to reference-to-video when you want image, video, or audio guidance.',
      },
      {
        question: 'Does Seedance 2.0 support reference-to-video on MaxVideoAI?',
        answer:
          'Yes. Seedance 2.0 exposes a dedicated reference-to-video route with up to 9 images, up to 3 reference videos, and up to 3 reference audio files, with 12 total files across the run.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Live quote in Generate',
    },
    surfaces: buildSeedance2Surfaces('standard', 'Standard'),
    promptExample:
      'Three-shot cinematic sequence, 15 seconds total, director-style camera language, realistic physics, synchronized dialogue and ambience, 16:9.',
  },
  {
    id: 'seedance-2-0-fast',
    modelSlug: 'seedance-2-0-fast',
    marketingName: 'Seedance 2.0 Fast',
    cardTitle: 'Seedance 2.0 Fast',
    provider: 'ByteDance',
    brandId: 'bytedance',
    family: 'seedance',
    versionLabel: '2.0 Fast',
    availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
    logoPolicy: 'textOnly',
    billingNote: 'Seedance 2 Fast uses Fal token pricing. Generate shows the active route, applies the MaxVideoAI margin, and rounds the quote up to the next cent before each run.',
    engine: SEEDANCE_2_0_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          audioToggle: true,
          notes: 'Draft-speed Seedance 2 route with 4-15s or auto, 480p/720p, and the same audio toggle.',
        },
      },
      {
        mode: 'i2v',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.i2v,
        ui: {
          modes: ['i2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Start image plus optional end image, 4-15s or auto, 480p/720p, and draft-speed iteration.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.ref2v,
        ui: {
          modes: ['ref2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Prompt-only is allowed, or add up to 9 images, 3 videos, and 3 audio files before moving winners into standard Seedance 2.0.',
        },
      },
    ],
    defaultFalModelId: SEEDANCE_2_ENDPOINTS.fast.t2v,
    seo: {
      title: 'Seedance 2.0 Fast — ByteDance Draft-Speed Video and Reference Model',
      description:
        'Seedance 2.0 Fast is the draft-speed Seedance 2 tier on MaxVideoAI for faster iteration, shorter feedback loops, 480p/720p output, and quick text, image, and reference-based comparisons.',
      canonicalPath: '/models/seedance-2-0-fast',
    },
    type: 'textImage',
    seoText:
      'Seedance 2.0 Fast is the draft-speed Seedance 2.0 variant for quicker iteration, auto or 4-15 second runs, 480p/720p output, optional end-frame image-to-video, and faster reference-based comparison rounds.',
    media: {
      videoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Seedance-2-husband-coming-home.webm',
      imagePath: '/hero/seedance-2-0.jpg',
      altText: 'Seedance 2.0 Fast demo frame',
    },
    demoUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Seedance-2-husband-coming-home.webm',
    prompts: [
      {
        title: 'Fast draft concept',
        prompt:
          'Draft-speed cinematic social ad, one hero action beat, fast camera move, native ambience, designed for quick iteration rather than final polish.',
        mode: 't2v',
      },
      {
        title: 'Fast still-to-motion test',
        prompt:
          'Animate one approved still into a short motion draft with clean subject continuity, restrained camera motion, and simple synced ambience.',
        mode: 'i2v',
      },
      {
        title: 'Fast reference continuity check',
        prompt:
          'Use four reference stills to test one character, one outfit, and one set, then compare framing, timing, and continuity before the standard-tier final.',
        mode: 'ref2v',
      },
    ],
    faqs: [
      {
        question: 'When should I use Seedance 2.0 Fast?',
        answer:
          'Use Seedance 2.0 Fast for faster ideation, comparison runs, and short draft passes before you commit to the standard Seedance 2.0 tier.',
      },
      {
        question: 'What should I compare Seedance 2.0 Fast against first?',
        answer:
          'Start with Veo 3.1 Fast and LTX 2.3 Fast to judge draft speed, motion behavior, and how closely the output matches the Seedance look you want.',
      },
      {
        question: 'Can I use image-to-video and reference-to-video with Seedance 2.0 Fast?',
        answer:
          'Yes. Fast supports image-to-video with an optional end frame and reference-to-video with image, video, and audio references when you want to validate timing before scaling up.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Live quote in Generate',
    },
    surfaces: buildSeedance2Surfaces('fast', 'Fast'),
    promptExample:
      'Fast draft pass for a three-beat product story, simple camera language, audio on, built for iteration before pushing finals through standard Seedance 2.0.',
  },
  {
    id: 'wan-2-5',
    modelSlug: 'wan-2-5',
    marketingName: 'Wan 2.5 Text & Image to Video',
    cardTitle: 'Wan 2.5',
    provider: 'Wan',
    brandId: 'wan',
    family: 'wan',
    versionLabel: 'Preview',
    availability: 'available',
    logoPolicy: 'textOnly',
    isLegacy: true,
    engine: WAN_2_5_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/wan-25-preview/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['480p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          notes: 'Optional WAV/MP3 soundtrack trims to 5 or 10 seconds.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/wan-25-preview/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['480p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload a single still (360–2000px) to drive the motion.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/wan-25-preview/text-to-video',
    seo: {
      title: 'Wan 2.5 – Audio-ready Text or Image to Video',
      description:
        'Generate Wan 2.5 preview clips from prompts or single reference stills, complete with optional audio and 480p–1080p tiers.',
      canonicalPath: '/models/wan-2-5',
    },
    type: 'textImage',
    seoText:
      'Wan 2.5 lets you storyboard cinematic beats with optional audio baked in. Swap between 5 or 10 second renders, 480p to 1080p resolutions, and prompt expansion to squeeze more detail out of shorter briefs.',
    demoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/wan-25-i2v-output.mp4',
    media: {
      videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/wan-25-i2v-output.mp4',
      imagePath: '/hero/wan-25.jpg',
      altText: 'Wan 2.5 render of a dragon warrior in golden light.',
    },
    prompts: [
      {
        title: 'Dragon warrior hero shot',
        prompt:
          'The white dragon warrior stands still as the camera circles slowly, volumetric haze, heroic lighting, triumphant orchestral swells.',
        mode: 't2v',
      },
      {
        title: 'Portrait push-in',
        prompt:
          'Animate the uploaded founder portrait into a confident walk-and-talk moment, warm lens flare, subtle handheld sway, ambient office score.',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'Does Wan 2.5 support background music?',
        answer:
          'Yes. Provide a WAV or MP3 between 3 and 30 seconds, and Wan trims or loops it to your 5 or 10 second render length.',
      },
      {
        question: 'Can I disable prompt expansion or the safety checker?',
        answer:
          'Toggle both options in Advanced settings. Leave them on for exploratory prompts or turn them off when you need literal output.',
      },
      {
        question: 'What image inputs work best for i2v?',
        answer:
          'Upload a clean 360px–2000px still. Wan keeps the first frame intact, so provide a polished board/screenshot whenever possible.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 75,
      durationSeconds: 5,
      resolution: '1080p',
      label: '1080p clip',
    },
    promptExample:
      'Slow aerial glide over a futuristic harbor at sunrise, neon reflections on water, synthwave soundtrack, ends on a close-up of the flagship.',
  },
  {
    id: 'wan-2-6',
    modelSlug: 'wan-2-6',
    marketingName: 'Wan 2.6 Text & Image to Video',
    cardTitle: 'Wan 2.6',
    provider: 'Wan',
    brandId: 'wan',
    family: 'wan',
    versionLabel: '2.6',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: WAN_2_6_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'wan/v2.6/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10, 15], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4'],
          audioToggle: true,
          notes: 'Optional WAV/MP3 soundtrack (3–30s, <=15MB).',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'wan/v2.6/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10, 15], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: [],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload one still; aspect ratio follows the source image.',
        },
      },
      {
        mode: 'r2v',
        falModelId: 'wan/v2.6/reference-to-video',
        ui: {
          modes: ['r2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4'],
          audioToggle: false,
          maxUploadMB: 30,
          notes: 'Upload 1–3 MP4/MOV references; tag them as @Video1/@Video2/@Video3.',
        },
      },
    ],
    defaultFalModelId: 'wan/v2.6/text-to-video',
    seo: {
      title: 'Wan 2.6 AI Video Generator (Text, Image & Reference) – MaxVideoAI',
      description:
        'Generate 5–15s cinematic clips with Wan 2.6 inside MaxVideoAI. Use multi-shot text prompts, animate a still image, or keep subject consistency with 1–3 reference videos. 720p/1080p, per-second pricing.',
      canonicalPath: '/models/wan-2-6',
    },
    type: 'textImage',
    seoText:
      'Wan 2.6 is a cinematic short-clip engine built for structured prompts and clean scene transitions. Switch between text, image, or reference video inputs to keep subjects consistent while iterating on short 5–15 second beats.',
    demoUrl: 'https://v3b.fal.media/files/b/0a8675cf/bCu9FiFXSjsSnIwOmjUOY_BVs2IFR3.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a8675cf/bCu9FiFXSjsSnIwOmjUOY_BVs2IFR3.mp4',
      imagePath: '/hero/wan-26.jpg',
      altText: 'Wan 2.6 demo render with cinematic motion and clean transitions.',
    },
    prompts: [
      {
        title: 'Vertical social mini-trailer',
        prompt:
          'Vertical 9:16, premium social ad. Shot 1 [0-3s] Macro of a product on a wet black surface, slow push-in, specular highlights. Shot 2 [3-8s] Whip pan reveal to a hand picking it up, soft rim light, bokeh city at night. Shot 3 [8-15s] Clean hero shot, subtle rotation, no text, no watermark.',
        mode: 't2v',
      },
      {
        title: 'Packshot motion from a still',
        prompt:
          'Continue from first frame. Slow dolly-in, gentle parallax, soft light sweep across the label, tiny dust particles, premium studio look, no text.',
        mode: 'i2v',
      },
      {
        title: 'Reference dance battle',
        prompt:
          'Dance battle between @Video1 and @Video2 in an empty museum hall. @Video1 starts center-left, @Video2 enters from right. Dynamic camera orbit, dramatic lighting.',
        mode: 'r2v',
        notes: 'Tag references with @Video1/@Video2/@Video3 in the prompt.',
      },
    ],
    faqs: [
      {
        question: 'Does Wan 2.6 support audio?',
        answer:
          'Audio URLs are optional for Text and Image modes. Reference mode does not support audio uploads.',
      },
      {
        question: 'How many reference videos can I upload?',
        answer:
          'Up to three MP4/MOV references. Tag them in the prompt as @Video1, @Video2, and @Video3.',
      },
      {
        question: 'What durations and resolutions are supported?',
        answer:
          'Text and Image modes run at 5, 10, or 15 seconds. Reference mode supports 5 or 10 seconds. Resolutions: 720p or 1080p.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 75,
      durationSeconds: 5,
      resolution: '1080p',
      label: '1080p clip',
    },
    promptExample:
      'Cinematic 16:9 mini-trailer. Shot 1 [0-5s] wide drone glide over a cliff road. Shot 2 [5-10s] close tracking shot of wheels on gravel. Shot 3 [10-15s] slow pull-back reveal of the full landscape, film grain.',
  },
  {
    id: 'minimax-hailuo-02-text',
    modelSlug: 'minimax-hailuo-02-text',
    marketingName: 'MiniMax Hailuo 02 Standard',
    cardTitle: 'MiniMax Hailuo 02',
    provider: 'MiniMax',
    brandId: 'minimax',
    family: 'hailuo',
    versionLabel: 'Standard',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: HAILUO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [6, 10], default: 6 },
          resolution: ['512P', '768P'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          fps: 25,
          audioToggle: false,
          notes: 'Enable the prompt optimiser toggle for longer scripts.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [6, 10], default: 6 },
          resolution: ['512P', '768P'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          fps: 25,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 20,
          audioToggle: false,
          notes: 'Upload an optional end frame if you need the shot to land on a specific still.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    seo: {
      title: 'MiniMax Hailuo 02 – Stylized Text & Image to Video',
      description:
        'Generate fast, stylized motion from prompts or animate uploaded stills with MiniMax Hailuo 02. Ideal for testing motion concepts, loops, and storyboard passes—silent and budget-friendly via MaxVideoAI.',
      canonicalPath: '/models/minimax-hailuo-02-text',
    },
    type: 'Text + Image · Stylized',
    seoText:
      'Generate stylized short clips from text or breathe life into stills using MiniMax Hailuo 02. Fast, silent, and ideal for loops, visual tests, or motion studies.',
    demoUrl: '/hero/minimax-video01.mp4',
    media: {
      videoUrl: '/hero/minimax-video01.mp4',
      imagePath: '/hero/minimax-video01.jpg',
      altText: 'Fast stylized motion demo from MiniMax Hailuo 02',
    },
    prompts: [
      {
        title: 'Cinematic fox run',
        prompt: 'A stylized fox running through a windy forest, camera follows from behind, swirling leaves, cinematic depth of field',
        mode: 't2v',
      },
      {
        title: 'Control room drift',
        prompt: 'Zoom slowly across a sci-fi spaceship control room, blinking lights and flickering screens, low-poly animation style',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'Does MiniMax Hailuo 02 support the prompt optimiser?',
        answer: 'Yes. Enable the optimiser toggle in the composer to clean up long prompts before you render.',
      },
      {
        question: 'Can I supply an end frame for Hailuo image-to-video runs?',
        answer: 'Upload an optional end frame in the composer. MaxVideoAI forwards it so the clip resolves on your target image.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 30,
      durationSeconds: 6,
      resolution: '768P',
      label: 'Silent clip',
    },
    promptExample:
      'A glowing butterfly flying across a dark cave, dust particles in the air, camera slowly zooms out',
  },
  {
    id: 'ltx-2-3-fast',
    modelSlug: 'ltx-2-3-fast',
    marketingName: 'LTX 2.3 Fast',
    cardTitle: 'LTX 2.3 Fast – quick text and image video',
    provider: 'Lightricks',
    brandId: 'lightricks',
    family: 'ltx',
    versionLabel: '2.3 Fast',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: LTX_2_3_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/ltx-2.3/text-to-video/fast',
        ui: {
          modes: ['t2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          fps: [24, 25, 48, 50],
          notes: 'Fast public LTX 2.3 path for text-to-video. Durations above 10s require 1080p / 25 fps.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/ltx-2.3/image-to-video/fast',
        ui: {
          modes: ['i2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['auto', '16:9', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heif'],
          maxUploadMB: 25,
          audioToggle: true,
          fps: [24, 25, 48, 50],
          notes: 'Fast public LTX 2.3 path for image-to-video with optional end frame. Durations above 10s require 1080p / 25 fps.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/ltx-2.3/text-to-video/fast',
    seo: {
      title: 'LTX 2.3 Fast AI Video – Fast Text & Image to Video | MaxVideoAI',
      description:
        'Generate fast AI video with LTX 2.3 Fast on MaxVideoAI. Text and image workflows support 6–20s clips, 1080p/1440p/4K, native audio, and Fal’s 25/50 fps options.',
      canonicalPath: '/models/ltx-2-3-fast',
    },
    type: 'textImage',
    seoText:
      'Run LTX 2.3 Fast for lightweight text-to-video and image-to-video passes with Fal’s full fast public controls: 6–20 second clips, 1080p to 4K, 24/25/48/50 fps, native audio, and optional start-to-end image transitions.',
    demoUrl: 'https://v3b.fal.media/files/b/0a8501d4/SE6zisjirfg6tK2zuAAHP_tXFRe5pl.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a8501d4/SE6zisjirfg6tK2zuAAHP_tXFRe5pl.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/1bd62e34-0e55-4f49-b434-295276b991d4-job_d895c3b0-562a-4e36-ae06-4ce083a47126.jpg',
      altText: 'LTX 2.3 Fast temporary demo clip using LTX 2 Fast media',
    },
    prompts: [
      {
        title: 'Fast product reveal',
        prompt: 'A sleek product reveal shot with reflective lighting, subtle camera push, clean commercial motion, 16:9',
        mode: 't2v',
      },
      {
        title: 'Animate a still',
        prompt: 'Bring this frame to life with a subtle camera move, layered parallax, and realistic motion',
        mode: 'i2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 31,
      durationSeconds: 6,
      resolution: '1080p',
      label: '6s 1080p clip',
    },
    promptExample:
      'A polished product shot on a mirrored pedestal, cinematic reflections, slow camera push, soft atmospheric haze',
  },
  {
    id: 'ltx-2-3',
    modelSlug: 'ltx-2-3-pro',
    marketingName: 'LTX 2.3 Pro',
    cardTitle: 'LTX 2.3 Pro – text, image, audio, extend and retake',
    provider: 'Lightricks',
    brandId: 'lightricks',
    family: 'ltx',
    versionLabel: 'Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: LTX_2_3_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/ltx-2.3/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [6, 8, 10], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          fps: [24, 25, 48, 50],
          notes: 'Main LTX 2.3 text-to-video workflow with native audio.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/ltx-2.3/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [6, 8, 10], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['auto', '16:9', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heif'],
          maxUploadMB: 25,
          audioToggle: true,
          fps: [24, 25, 48, 50],
          notes: 'Animate a still with optional native audio and an optional end frame.',
        },
      },
      {
        mode: 'a2v',
        falModelId: 'fal-ai/ltx-2.3/audio-to-video',
        ui: {
          modes: ['a2v'],
          maxUploadMB: 30,
          notes: 'Requires source audio. Optional prompt, first-frame image, and guidance scale.',
        },
      },
      {
        mode: 'extend',
        falModelId: 'fal-ai/ltx-2.3/extend-video',
        ui: {
          modes: ['extend'],
          duration: { min: 1, default: 5 },
          maxUploadMB: 30,
          notes: 'Extend an existing clip by up to 20s. Choose start/end and optional context seconds.',
        },
      },
      {
        mode: 'retake',
        falModelId: 'fal-ai/ltx-2.3/retake-video',
        ui: {
          modes: ['retake'],
          duration: { min: 2, default: 5 },
          maxUploadMB: 30,
          notes: 'Retake a source clip with prompt, start time, duration, and replace mode controls.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/ltx-2.3/text-to-video',
    seo: {
      title: 'LTX 2.3 Pro AI Video – Text, Image, Audio, Extend & Retake | MaxVideoAI',
      description:
        'Use LTX 2.3 Pro on MaxVideoAI for text-to-video, image-to-video, audio-to-video, extend-video and retake-video workflows with Fal’s official 1080p/1440p/4K and 24/25/48/50 fps options.',
      canonicalPath: '/models/ltx-2-3-pro',
    },
    type: 'textImage',
    seoText:
      'LTX 2.3 Pro brings Lightricks text, image, audio, extend, and retake workflows into one page while keeping Fal’s actual controls coherent by mode: 6–10s text/image clips up to 4K, audio-driven video, plus extend and retake tools for source footage.',
    demoUrl: 'https://v3b.fal.media/files/b/0a85021e/wplTIb8GxgfjsJLL29RMu_SPGFhmiY.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a85021e/wplTIb8GxgfjsJLL29RMu_SPGFhmiY.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/f397ab6d-d0ef-44eb-977a-3419f494d17e-job_cda079d3-9895-45a0-866c-2dbf57593463.jpg',
      altText: 'LTX 2.3 Pro temporary demo clip using LTX 2 Pro media',
    },
    prompts: [
      {
        title: 'Trailer beat',
        prompt:
          'A cinematic trailer beat in a neon industrial alley, wet asphalt reflections, slow push-in, atmospheric smoke, 16:9',
        mode: 't2v',
      },
      {
        title: 'Animate a portrait still',
        prompt: 'Subtle head turn, realistic cloth motion, gentle handheld drift, soft practical lights',
        mode: 'i2v',
      },
      {
        title: 'Audio-driven performance',
        prompt: 'Performance-driven camera move that matches the rhythm and emotion of the uploaded audio',
        mode: 'a2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 47,
      durationSeconds: 6,
      resolution: '1080p',
      label: '6s 1080p clip',
    },
    promptExample:
      'A futuristic alley soaked in rain, cinematic reflections, drifting steam, slow dolly move, dramatic practical lighting',
  },
  {
    id: 'ltx-2-fast',
    modelSlug: 'ltx-2-fast',
    marketingName: 'LTX Video 2.0 Fast',
    cardTitle: 'LTX-2 Fast – Quick cinematic video with audio',
    provider: 'Lightricks',
    brandId: 'lightricks',
    family: 'ltx',
    versionLabel: 'Fast',
    availability: 'available',
    logoPolicy: 'textOnly',
    isLegacy: true,
    engine: LTX_2_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/ltx-2/text-to-video/fast',
        ui: {
          modes: ['t2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9'],
          audioToggle: true,
          notes: 'Native audio is on by default; 12–20s runs require 1080p at 25fps per Fal.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/ltx-2/image-to-video/fast',
        ui: {
          modes: ['i2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload one reference still; 12–20s runs require 1080p at 25fps per Fal.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/ltx-2/text-to-video/fast',
    seo: {
      title: 'LTX-2 Fast AI Video – Text & Image to Video with Audio | MaxVideoAI',
      description:
        'Generate fast cinematic AI videos with LTX-2 Fast. Text and image to video with synchronized audio, up to 4K, ideal for rapid iteration and social content.',
      canonicalPath: '/models/ltx-2-fast',
    },
    type: 'textImage',
    demoUrl: 'https://v3b.fal.media/files/b/0a8501d4/SE6zisjirfg6tK2zuAAHP_tXFRe5pl.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a8501d4/SE6zisjirfg6tK2zuAAHP_tXFRe5pl.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/1bd62e34-0e55-4f49-b434-295276b991d4-job_d895c3b0-562a-4e36-ae06-4ce083a47126.jpg',
      altText: 'LTX-2 Fast sample: continuous walkthrough in a modern office',
    },
    prompts: [
      {
        title: 'Office walkthrough (one take)',
        prompt:
          '18–20 second 16:9 continuous shot that follows a team lead through a startup office. Camera glides from entrance to window, passing collaborators, plants and whiteboards under warm daylight with soft office ambience + light score.',
        mode: 't2v',
      },
      {
        title: 'Golden-hour crosswalk (8s)',
        prompt:
          'Handheld-style tracking shot at a busy crosswalk. Camera starts behind a woman with a backpack, then steps onto the street as warm sunlight flares across her face and cars pass in the background. Soft city ambience + upbeat music bed.',
        mode: 't2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 31,
      durationSeconds: 6,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'A cowboy walking through a dusty town at high noon, camera following from behind, cinematic depth, realistic lighting, western mood, 4K film grain.',
  },
  {
    id: 'ltx-2',
    modelSlug: 'ltx-2',
    marketingName: 'LTX Video 2.0 Pro',
    cardTitle: 'LTX-2 Pro – 4K cinematic video with audio',
    provider: 'Lightricks',
    brandId: 'lightricks',
    family: 'ltx',
    versionLabel: 'Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    isLegacy: true,
    engine: LTX_2_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/ltx-2/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [6, 8, 10], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9'],
          audioToggle: true,
          notes: 'Higher fidelity, audio on by default; toggle off for silent renders.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/ltx-2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [6, 8, 10], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload a crisp still; Pro maintains lip-sync and ambience.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/ltx-2/text-to-video',
    seo: {
      title: 'LTX-2 Pro AI Video – High-Fidelity Text & Image to Video with Audio | MaxVideoAI',
      description:
        'Create high-fidelity cinematic AI videos with LTX-2 Pro. Text and image to video with synchronized audio, up to 4K and 50 fps, ideal for premium campaigns and production work.',
      canonicalPath: '/models/ltx-2',
    },
    type: 'textImage',
    demoUrl: 'https://v3b.fal.media/files/b/0a85021e/wplTIb8GxgfjsJLL29RMu_SPGFhmiY.mp4',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a85021e/wplTIb8GxgfjsJLL29RMu_SPGFhmiY.mp4',
      imagePath:
        'https://videohub-uploads-us.s3.amazonaws.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/f397ab6d-d0ef-44eb-977a-3419f494d17e-job_cda079d3-9895-45a0-866c-2dbf57593463.jpg',
      altText: 'LTX-2 Pro sample: dreamlike city street folding overhead',
    },
    prompts: [
      {
        title: 'City street folds upward (8s)',
        prompt:
          '8-second 16:9 4K shot of a modern avenue lifting into the sky—cars, streetlights and pedestrians bend upward while the camera arcs overhead through volumetric dust and reflections.',
        mode: 't2v',
        notes: 'Matches the hero clip; includes layered trailer whooshes and rumble.',
      },
      {
        title: 'Souk jewel chase',
        prompt:
          '8–10s chase through a golden-hour Middle Eastern souk. Camera dives from rooftops into tight alleys as a thief dodges hanging fabrics and fruit carts bursting into slow-motion oranges.',
        mode: 't2v',
      },
      {
        title: 'Orbital ring collapse',
        prompt:
          '10s aerial glide over a futuristic coastal city as an orbital ring fractures overhead, debris raining through clouds before an energy shield freezes the shards mid-air.',
        mode: 't2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 47,
      durationSeconds: 6,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'A cowboy walking through a dusty town at high noon, camera following from behind, cinematic depth, realistic lighting, western mood, 4K film grain.',
  },
  {
    id: 'nano-banana',
    modelSlug: 'nano-banana',
    marketingName: 'Nano Banana (Image Generation)',
    cardTitle: 'Nano Banana',
    provider: 'Google',
    brandId: 'google',
    family: 'nano-banana',
    versionLabel: 'Nano',
    availability: 'available',
    isLegacy: true,
    logoPolicy: 'textOnly',
    billingNote: '$0.039 per image via Fal queue',
    engine: NANO_BANANA_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'fal-ai/nano-banana',
        ui: {
          modes: ['t2i'],
          aspectRatio: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          notes: 'Launch up to 8 high-quality renders from one prompt.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'fal-ai/nano-banana/edit',
        ui: {
          modes: ['i2i'],
          aspectRatio: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Upload 1–4 references to remix or extend shots.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/nano-banana',
    seo: {
      title: 'Nano Banana – Google Text-to-Image on MaxVideoAI',
      description:
        'Generate photoreal stills or remix reference shots with Nano Banana, the Google-powered image model available via Fal.ai and MaxVideoAI credits.',
      canonicalPath: '/models/nano-banana',
    },
    type: 'image',
    seoText:
      'Bring your existing MaxVideoAI workflow to still imagery. Nano Banana covers both text-to-image runs and prompt-driven edits from the same prompt lab, wallet, and logging stack.',
    media: {
      videoUrl: '/hero/pika-22.mp4',
      imagePath: 'https://v3b.fal.media/files/b/elephant/swnM7Nh3lbF0WcmLFEd7v.png',
      altText: 'Nano Banana image preview',
    },
    prompts: [
      {
        title: 'Stylized action still',
        prompt:
          'Action shot of a black lab leaping through a suburban pool at golden hour, water droplets frozen mid-air, 85mm lens flare.',
        mode: 't2i',
        notes: 'Batch 3 variants to explore composition tweaks.',
      },
      {
        title: 'Reference remix',
        prompt:
          'Turn this studio portrait into a moody cyberpunk scene with neon rim lights and rain, keeping the subject framing intact.',
        mode: 'i2i',
        notes: 'Upload 1–2 references and set num_images to 2.',
      },
    ],
    faqs: [
      {
        question: 'Can Nano Banana edit existing photos?',
        answer:
          'Yes. Switch to the Edit mode, upload one or more images, then describe the transformation—Nano Banana preserves structure while applying the new look.',
      },
  {
    question: 'How does pricing work for Nano Banana?',
    answer:
      'Each image costs $0.039 from your MaxVideoAI wallet. Running 4 outputs in a batch equals $0.156, so you always know the spend up front.',
  },
],
pricingHint: {
  currency: 'USD',
  amountCents: 4,
  label: 'Per generated image',
},
promptExample:
      'Macro photo of a dew-covered leaf with neon reflections, depth-of-field bokeh, studio lighting',
    category: 'image',
  },
  {
    id: 'nano-banana-pro',
    modelSlug: 'nano-banana-pro',
    marketingName: 'Nano Banana Pro',
    cardTitle: 'Nano Banana Pro',
    provider: 'Google',
    brandId: 'google',
    family: 'nano-banana',
    versionLabel: 'Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: '$0.15 per 1K/2K image · $0.30 at 4K via Fal queue',
    engine: NANO_BANANA_PRO_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'fal-ai/nano-banana-pro',
        ui: {
          modes: ['t2i'],
          aspectRatio: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          resolution: ['1k', '2k', '4k'],
          notes: 'Studio-grade text rendering, character consistency, and optional 4K outputs.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'fal-ai/nano-banana-pro/edit',
        ui: {
          modes: ['i2i'],
          aspectRatio: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          resolution: ['1k', '2k', '4k'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Upload 1–4 references; Fal handles up to 14 sources without manual masks.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/nano-banana-pro',
    seo: {
      title: 'Nano Banana Pro – 4K Text-to-Image & Editing | MaxVideoAI',
      description:
        'Generate studio-quality stills with Google’s Gemini 3-powered Nano Banana Pro. 1K, 2K, and 4K outputs, multi-image reference editing, and razor-sharp typography in MaxVideoAI.',
      canonicalPath: '/models/nano-banana-pro',
    },
    type: 'image',
    seoText:
      'Nano Banana Pro brings Google’s Gemini 3 Pro image stack into MaxVideoAI. Render 1K/2K explorations, upgrade to 4K finals, or upload references for precise edits—without leaving the workspace.',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a851821/XWMX6UdfAGFISJGdOLus4.png',
      imagePath: 'https://v3b.fal.media/files/b/0a851821/XWMX6UdfAGFISJGdOLus4.png',
      altText: 'Nano Banana Pro sample: video editor lit by blue and orange LEDs at triple monitors',
    },
    prompts: [
      {
        title: 'Editing suite portrait (16:9)',
        prompt:
          'Ultra-realistic cinematic portrait of a video creator in a modern editing studio at night with three ultra-wide monitors glowing with colorful timelines, blue/orange LED spill, rim light on the hair, shallow depth (85mm f/1.4), crisp eyes, natural skin and subtle film grain. 4K, no watermark or stray text.',
        mode: 't2i',
      },
      {
        title: 'Square avatar variant',
        prompt:
          'Reframe the same scene as a 1:1 avatar: keep the glowing monitors, dark background, and rim light while centering the creator’s face with clean bokeh and zero text artifacts.',
        mode: 't2i',
      },
    ],
    faqs: [
      {
        question: 'Does Nano Banana Pro support 4K renders?',
        answer:
          'Yes. Choose 4K in the composer for the sharpest output. Pricing doubles versus 1K/2K, so iterate at lower res before locking finals.',
      },
      {
        question: 'How many reference images can I use for edits?',
        answer:
          'The Fal endpoint accepts up to 14 images via API. The MaxVideoAI composer lets you upload 1–4 refs to keep wardrobe, layout, or people consistent across edits.',
      },
      {
        question: 'Is Nano Banana Pro licensed for commercial projects?',
        answer:
          'Yes. Jobs run through Fal with commercial-use rights, so you can export campaign stills, packaging renders, and product imagery for client deliverables.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 15,
      label: 'Per 1K/2K image (4K doubles)',
    },
    promptExample:
      '2K cinematic portrait of a founder delivering a keynote on stage, accurate LED wall text “NEXT QUARTER IS NOW”, shallow depth of field.',
    category: 'image',
  },
  {
    id: 'nano-banana-2',
    modelSlug: 'nano-banana-2',
    marketingName: 'Nano Banana 2',
    cardTitle: 'Nano Banana 2',
    provider: 'Google',
    brandId: 'google',
    family: 'nano-banana',
    versionLabel: '2',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: '$0.08 per 1K image · 0.5K $0.04 · 2K $0.12 · 4K $0.16 · web search +$0.015/request',
    engine: NANO_BANANA_2_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'fal-ai/nano-banana-2',
        ui: {
          modes: ['t2i'],
          aspectRatio: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
          resolution: ['0.5k', '1k', '2k', '4k'],
          notes: 'Balanced quality, broader aspect ratios, and optional web-grounded image generation.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'fal-ai/nano-banana-2/edit',
        ui: {
          modes: ['i2i'],
          aspectRatio: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
          resolution: ['0.5k', '1k', '2k', '4k'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Edit with up to 14 reference images and optional web grounding.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/nano-banana-2',
    seo: {
      title: 'Nano Banana 2 – Google Image Generation & Editing | MaxVideoAI',
      description:
        'Use Nano Banana 2 in MaxVideoAI for fast 0.5K to 4K still generation, wide and extreme aspect ratios, semantic editing, and optional web-grounded image prompts.',
      canonicalPath: '/models/nano-banana-2',
    },
    type: 'image',
    seoText:
      'Nano Banana 2 expands the MaxVideoAI image workspace with lower-cost drafts, broader aspect ratios, advanced output controls, optional web-grounded prompting, and support for larger multi-image edit sets.',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/elephant/swnM7Nh3lbF0WcmLFEd7v.png',
      imagePath: 'https://v3b.fal.media/files/b/elephant/swnM7Nh3lbF0WcmLFEd7v.png',
      altText: 'Nano Banana 2 sample image preview',
    },
    prompts: [
      {
        title: 'Ultra-wide concept frame',
        prompt:
          '8:1 panoramic concept art of a futuristic desert transit hub at sunrise, long shadows, reflective glass, disciplined signage system, editorial realism.',
        mode: 't2i',
        notes: 'Use 0.5K or 1K for fast framing passes before locking finals.',
      },
      {
        title: 'Grounded product scene',
        prompt:
          'Create a premium skincare launch still informed by current high-end retail display trends, soft daylight, pale stone surfaces, minimal serif packaging, polished campaign mood.',
        mode: 't2i',
        notes: 'Enable web search when you want current visual references to influence the brief.',
      },
      {
        title: 'Multi-reference edit',
        prompt:
          'Combine these reference images into one cohesive campaign still: preserve the bag silhouette, keep the studio lighting direction, unify the palette, and clean up distracting reflections.',
        mode: 'i2i',
        notes: 'Upload multiple references to lock materials, composition cues, and color treatment.',
      },
    ],
    faqs: [
      {
        question: 'What resolutions does Nano Banana 2 support?',
        answer:
          'You can render at 0.5K, 1K, 2K, and 4K. 1K is the base tier, while 0.5K is cheaper and 2K/4K cost more.',
      },
      {
        question: 'Does Nano Banana 2 support multi-image edits?',
        answer:
          'Yes. The edit route accepts up to 14 reference images, which is useful for product consistency, moodboards, and controlled semantic edits.',
      },
      {
        question: 'What does web search do?',
        answer:
          'Web search lets the model ground the request with current web context when you need fresher references. It adds a small flat request fee on top of image pricing.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 8,
      resolution: '1k',
      label: 'Per 1K image',
    },
    promptExample:
      '1K editorial still of a boutique hotel lobby at blue hour, polished travertine, warm sconces, clean signage, realistic reflections, premium travel-magazine look.',
    category: 'image',
  },
  {
    id: 'gpt-image-2',
    modelSlug: 'gpt-image-2',
    marketingName: 'GPT Image 2',
    cardTitle: 'GPT Image 2',
    provider: 'OpenAI',
    brandId: 'openai',
    family: 'gpt-image',
    versionLabel: '2',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'Fal pricing varies by quality and image_size: canonical sizes run from $0.01 low-quality 1024x768 to $0.41 high-quality 3840x2160.',
    engine: GPT_IMAGE_2_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'openai/gpt-image-2',
        ui: {
          modes: ['t2i'],
          resolution: [
            'landscape_4_3',
            'square_hd',
            'square',
            'portrait_4_3',
            'portrait_16_9',
            'landscape_16_9',
            '1024x768',
            '1024x1024',
            '1024x1536',
            '1920x1080',
            '2560x1440',
            '3840x2160',
            'custom',
          ],
          notes: 'Quality-first image generation with strong text rendering, photorealism, and product-shot fidelity.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'openai/gpt-image-2/edit',
        ui: {
          modes: ['i2i'],
          resolution: [
            'auto',
            'landscape_4_3',
            'square_hd',
            'square',
            'portrait_4_3',
            'portrait_16_9',
            'landscape_16_9',
            '1024x768',
            '1024x1024',
            '1024x1536',
            '1920x1080',
            '2560x1440',
            '3840x2160',
            'custom',
          ],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Upload references for fine-grained edits; optional mask URL and quality controls map to the Fal edit endpoint.',
        },
      },
    ],
    defaultFalModelId: 'openai/gpt-image-2',
    seo: {
      title: 'GPT Image 2 - OpenAI Image Generation & Editing | MaxVideoAI',
      description:
        'Use GPT Image 2 in MaxVideoAI for text-to-image, image edits, high-fidelity text rendering, product photography, Fal image_size presets/custom size, quality controls, and PNG/JPEG/WEBP output.',
      canonicalPath: '/models/gpt-image-2',
    },
    type: 'image',
    seoText:
      'GPT Image 2 brings OpenAI’s quality-first image model into the same MaxVideoAI image workspace as Nano Banana: one model selector for text-to-image and image-to-image, with Fal image_size presets, custom width/height, quality, output format, and mask URL controls.',
    media: {
      videoUrl: 'https://v3b.fal.media/files/b/0a9711ec/ogbMf2sTKAjNFA4vpWOrx_HRS2SDhR.png',
      imagePath: 'https://v3b.fal.media/files/b/0a9711ec/ogbMf2sTKAjNFA4vpWOrx_HRS2SDhR.png',
      altText: 'GPT Image 2 sample infographic image preview',
    },
    prompts: [
      {
        title: 'Text-heavy product ad',
        prompt:
          'A polished product campaign still for a coffee bag labeled "Summit Roast", readable flavor notes, warm wooden table, controlled daylight, premium catalog photography.',
        mode: 't2i',
        notes: 'Use High quality when text accuracy and packaging detail matter.',
      },
      {
        title: 'Infographic layout',
        prompt:
          'A clean editorial infographic explaining a creator workflow, precise section labels, icon grid, crisp typography, white background, subtle accent colors.',
        mode: 't2i',
      },
      {
        title: 'Reference product edit',
        prompt:
          'Keep the exact product shape and label hierarchy, replace the background with a bright e-commerce tabletop scene, remove distracting reflections, and preserve readable text.',
        mode: 'i2i',
        notes: 'Upload the product reference, then add a mask URL only when the edit should be constrained.',
      },
    ],
    faqs: [
      {
        question: 'Does GPT Image 2 support both generation and editing?',
        answer:
          'Yes. MaxVideoAI exposes one GPT Image 2 entry with text-to-image mapped to openai/gpt-image-2 and image-to-image mapped to openai/gpt-image-2/edit.',
      },
      {
        question: 'Which GPT Image 2 controls are available?',
        answer:
          'The image workspace exposes Fal image_size presets, canonical custom sizes up to 3840x2160, custom width/height, quality levels, num_images, output format, reference images for edits, and an optional mask URL.',
      },
      {
        question: 'How is GPT Image 2 priced?',
        answer:
          'Fal prices follow the quality x size table: 1024x768 is $0.01 / $0.04 / $0.15 and 3840x2160 is $0.02 / $0.11 / $0.41 for Low / Medium / High before MaxVideoAI account pricing rules.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 15,
      resolution: '1024x768',
      label: 'High quality 1024x768',
    },
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: false,
        includeInFamilyCopy: false,
      },
      compare: {
        suggestOpponents: [],
        publishedPairs: [],
        includeInHub: false,
      },
      app: {
        enabled: true,
        discoveryRank: 7,
        variantGroup: 'gpt-image',
        variantLabel: '2',
      },
      pricing: {
        includeInEstimator: true,
        featuredScenario: 'high-quality product still',
      },
    },
    promptExample:
      'High-quality product photo of a coffee bag labeled "Summit Roast", readable packaging text, rustic wood table, soft daylight, catalog-ready composition.',
    category: 'image',
  },
];

function materializeFalEngineEntry(entry: RawFalEngineEntry): FalEngineEntry {
  const partnerBrand = getPartnerByBrandId(entry.brandId);
  const defaults = buildDefaultModelPublicationSurfaces({
    id: entry.id,
    modelSlug: entry.modelSlug,
    family: entry.family,
    category: entry.category,
  });

  return {
    ...entry,
    logoPolicy: partnerBrand?.policy.logoAllowed ? 'logoAllowed' : entry.logoPolicy,
    surfaces: mergeModelPublicationSurfaces(defaults, entry.surfaces),
  };
}

export const FAL_ENGINE_REGISTRY: readonly FalEngineEntry[] = RAW_FAL_ENGINE_REGISTRY.map(materializeFalEngineEntry);

export function listFalEngines(): FalEngineEntry[] {
  return FAL_ENGINE_REGISTRY.slice();
}

export function hasExplicitFalEngineSurfaces(engineId: string): boolean {
  return Boolean(RAW_FAL_ENGINE_REGISTRY.find((entry) => entry.id === engineId)?.surfaces);
}

export function getEngineAliases(entry: FalEngineEntry): string[] {
  const aliases = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length) {
      aliases.add(value.trim());
    }
  };
  add(entry.id);
  add(entry.engine.id);
  add(entry.defaultFalModelId);
  if (entry.engine?.providerMeta && typeof entry.engine.providerMeta.modelSlug === 'string') {
    add(entry.engine.providerMeta.modelSlug);
  }
  entry.modes.forEach((mode) => {
    add(mode.falModelId);
  });
  return Array.from(aliases);
}

export function listImageEngineAliases(): string[] {
  const aliasSet = new Set<string>();
  listFalEngines()
    .filter((engine) => (engine.category ?? 'video') === 'image')
    .forEach((entry) => {
      getEngineAliases(entry).forEach((alias) => aliasSet.add(alias));
    });
  return Array.from(aliasSet);
}

export function getFalEngineById(id: string): FalEngineEntry | undefined {
  return FAL_ENGINE_REGISTRY.find((entry) => entry.id === id);
}

const LEGACY_MODEL_SLUG_ALIASES: Record<string, string> = {
  'openai-sora-2': 'sora-2',
  'openai-sora-2-pro': 'sora-2-pro',
  'google-veo-3': 'veo-3-1',
  'veo-3': 'veo-3-1',
  veo3: 'veo-3-1',
  'veo3.1': 'veo-3-1',
  'google-veo-3-fast': 'veo-3-1-fast',
  'veo-3-fast': 'veo-3-1-fast',
  veo3fast: 'veo-3-1-fast',
  'veo3-fast': 'veo-3-1-fast',
  'google-veo-3-1-fast': 'veo-3-1-fast',
  'veo-3-1-first-last': 'veo-3-1',
  'veo-3-1-first-last-fast': 'veo-3-1-fast',
  'veo-3-lite': 'veo-3-1-lite',
  veo3lite: 'veo-3-1-lite',
  'veo3-lite': 'veo-3-1-lite',
  'veo3.1-lite': 'veo-3-1-lite',
  'seedance-2-fast': 'seedance-2-0-fast',
  'seedance-2.0-fast': 'seedance-2-0-fast',
  'seedance-v2-fast': 'seedance-2-0-fast',
  'seedance-v2.0-fast': 'seedance-2-0-fast',
  'seedance-fast': 'seedance-2-0-fast',
  'ltx-2-3': 'ltx-2-3-pro',
  'pika-2-2': 'pika-text-to-video',
  'pika-image-to-video': 'pika-text-to-video',
  'minimax-video-01': 'minimax-hailuo-02-text',
  'minimax-video-1': 'minimax-hailuo-02-text',
  'minimax-hailuo-02': 'minimax-hailuo-02-text',
  'minimax-hailuo-02-pro': 'minimax-hailuo-02-text',
  'minimax-hailuo-02-image': 'minimax-hailuo-02-text',
  'hailuo-2-pro': 'minimax-hailuo-02-text',
  'kling-25-turbo-pro': 'kling-2-5-turbo',
  'kling-2-5-turbo-pro': 'kling-2-5-turbo',
};

export function canonicalizeFalModelSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  return LEGACY_MODEL_SLUG_ALIASES[normalized] ?? normalized;
}

export function getFalEngineBySlug(slug: string): FalEngineEntry | undefined {
  const normalized = slug.trim().toLowerCase();
  const canonicalSlug = canonicalizeFalModelSlug(slug);

  const directMatch = FAL_ENGINE_REGISTRY.find((entry) => entry.modelSlug.toLowerCase() === canonicalSlug);
  if (directMatch) {
    return directMatch;
  }

  return FAL_ENGINE_REGISTRY.find((entry) => {
    const aliases = getEngineAliases(entry).map((alias) => alias.trim().toLowerCase());
    return aliases.includes(normalized);
  });
}
