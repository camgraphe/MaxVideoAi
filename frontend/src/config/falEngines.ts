import type { EngineCaps, EngineAvailability, Mode } from '../../types/engines';

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
  fps?: number;
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
  modes: ['t2v', 'i2v'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
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
        default: 'true',
        modes: ['t2v'],
      },
      {
        id: 'auto_fix',
        type: 'enum',
        label: 'Auto fix policy',
        values: ['true', 'false'],
        default: 'true',
        modes: ['t2v'],
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
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
  modes: ['t2v', 'i2v'],
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
        default: 'true',
        modes: ['t2v'],
      },
      {
        id: 'auto_fix',
        type: 'enum',
        label: 'Auto fix policy',
        values: ['true', 'false'],
        default: 'true',
        modes: ['t2v'],
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
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

const VEO_3_1_FIRST_LAST_ENGINE: EngineCaps = {
  id: 'veo-3-1-first-last',
  label: 'Google Veo 3.1 First/Last Frame',
  provider: 'Google',
  version: '3.1',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['i2v', 'i2i'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['auto', '9:16', '16:9', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 12,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
      {
        id: 'first_frame_url',
        type: 'image',
        label: 'First frame',
        modes: ['i2v', 'i2i'],
        requiredInModes: ['i2v', 'i2i'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'last_frame_url',
        type: 'image',
        label: 'Last frame',
        modes: ['i2v', 'i2i'],
        requiredInModes: ['i2v', 'i2i'],
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
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
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
    modelSlug: 'fal-ai/veo3.1/first-last-frame-to-video',
  },
  availability: 'available',
  brandId: 'google-veo',
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
  status: 'early_access',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
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
      default: 33.6,
    },
    addons: {
      audio_off: {
        perSecondCents: -11.2,
      },
      voice_control: {
        perSecondCents: 5.6,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.336,
    currency: 'USD',
    notes: '$0.224/s audio off, $0.336/s audio on, $0.392/s voice control',
  },
  updatedAt: '2026-02-09T00:00:00Z',
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
      default: 25.2,
    },
    addons: {
      audio_off: {
        perSecondCents: -8.4,
      },
      voice_control: {
        perSecondCents: 5.6,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.252,
    currency: 'USD',
    notes: '$0.168/s audio off, $0.252/s audio on, $0.308/s voice control',
  },
  updatedAt: '2026-02-09T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'kling',
    modelSlug: 'fal-ai/kling-video/v3/standard/text-to-video',
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
  status: 'early_access',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 15,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
    videoMaxMB: 50,
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
        values: ['5', '10', '15'],
        default: '10',
        min: 5,
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
        values: ['720p', '1080p'],
        default: '1080p',
      },
      {
        id: 'reference_image_urls',
        type: 'text',
        label: 'Reference images (up to 9)',
      },
      {
        id: 'reference_video_urls',
        type: 'text',
        label: 'Reference video clips (up to 3)',
      },
      {
        id: 'reference_audio_urls',
        type: 'text',
        label: 'Reference audio clips (up to 3)',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
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
      default: 0,
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0,
    currency: 'USD',
    notes: 'Pricing details will be confirmed at launch.',
  },
  updatedAt: '2026-02-19T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'bytedance',
    modelSlug: 'fal-ai/seedance-2.0/text-to-video',
  },
  availability: 'waitlist',
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
    notes: '$0.20 per 5s @1080p, $0.40 @1440p, $0.80 @4K',
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
    notes: '$0.30 per 5s @1080p, $0.60 @1440p, $1.20 @4K',
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
        values: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: '1:1',
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

export const FAL_ENGINE_REGISTRY: FalEngineEntry[] = [
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
        falModelId: 'fal-ai/veo3.1/reference-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1',
    seo: {
      title: 'Veo 3.1 – Advanced Text-to-Video & Native Audio Engine',
      description:
        'Generate cinematic 8-second videos with native audio using Veo 3.1 by Google DeepMind on MaxVideoAI. Reference-to-video guidance, multi-image fidelity, pay-as-you-go pricing from $0.52/s.',
      canonicalPath: '/models/veo-3-1',
    },
    type: 'Text or image',
    demoUrl: 'https://v3b.fal.media/files/b/kangaroo/oUCiZjQwEy6bIQdPUSLDF_output.mp4',
    media: {
      videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4',
      imagePath: '/hero/veo3.jpg',
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
        mode: 'i2v',
        notes: 'Attach 2 to 4 stills via Reference images to lock identity.',
      },
    ],
    faqs: [
      {
        question: 'Does Veo 3 ship with the latest motion tuning?',
        answer: 'Yes. MaxVideoAI syncs routing with Google DeepMind updates so motion tuning stays current without manual work.',
      },
      {
        question: 'Can I brief Veo 3 with reference images?',
        answer: 'Upload stills when drafting your prompt. The render queue keeps the references attached end-to-end.',
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
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/fast',
    seo: {
      title: 'Veo 3.1 Fast – High-Speed AI Video Generation (with or without Audio)',
      description:
        'Use Veo 3.1 Fast for affordable, fast AI video generation. Up to 8-second clips with optional native audio—ideal for social formats and iterative testing.',
      canonicalPath: '/models/veo-3-1-fast',
    },
    type: 'Text or image',
    seoText:
      'Veo 3.1 Fast helps you test cinematic prompts with optional audio. Use it for short loops, mobile formats, or quick experiments with DeepMind fidelity at a lower cost.',
    demoUrl: '/hero/veo3.mp4',
    media: {
      videoUrl: '/hero/veo3.mp4',
      imagePath: '/hero/veo3.jpg',
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
        notes: 'Upload a single reference image and enable audio for subtle ambience or leave it off for silent loops.',
      },
    ],
    faqs: [
      {
        question: 'Does Veo 3 ship with the latest motion tuning?',
        answer: 'Yes. MaxVideoAI syncs routing with Google DeepMind updates so motion tuning stays current without manual work.',
      },
      {
        question: 'Can I brief Veo 3 with reference images?',
        answer: 'Upload stills when drafting your prompt. The render queue keeps the references attached end-to-end.',
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
    id: 'veo-3-1-first-last',
    modelSlug: 'veo-3-1-first-last',
    marketingName: 'Google Veo 3.1 First/Last Frame',
    cardTitle: 'Veo 3.1 First/Last',
    provider: 'Google',
    brandId: 'google-veo',
    family: 'veo',
    versionLabel: '3.1',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: VEO_3_1_FIRST_LAST_ENGINE,
    modes: [
      {
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/first-last-frame-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '9:16', '16:9', '1:1'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
        },
      },
      {
        mode: 'i2i',
        falModelId: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
        ui: {
          modes: ['i2i'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '9:16', '16:9', '1:1'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/first-last-frame-to-video',
    seo: {
      title: 'Veo 3.1 First/Last – Bridge two keyframes with DeepMind fidelity',
      description:
        'Upload starting and ending frames, write a brief, and let Veo 3.1 animate seamless transitions with optional native audio. Swap to Fast mode for cheaper iterations.',
      canonicalPath: '/models/veo-3-1-first-last',
    },
    type: 'Image pair',
    demoUrl: '/hero/veo3.mp4',
    media: {
      videoUrl: '/hero/veo3.mp4',
      imagePath: '/hero/veo3.jpg',
      altText: 'Bridge between first and last frames with Veo 3.1',
    },
    prompts: [
      {
        title: 'Hero transition',
        prompt: 'Bridge a product hero shot from glossy studio lighting to lifestyle daylight in eight seconds, upbeat VO “This is Veo 3.1 First/Last.”',
        mode: 'i2v',
        notes: 'Upload first and last frames to lock wardrobe, lighting, and layout.',
      },
      {
        title: 'Fast storyboard bridge',
        prompt: 'Animate between two storyboard frames for a sprint review, minimal VO, ambient city tone.',
        mode: 'i2i',
      },
    ],
    faqs: [
      {
        question: 'What’s the difference between Standard and Fast modes?',
        answer:
          'Standard mode routes through Veo 3.1 for highest fidelity, Fast mode uses Veo 3.1 Fast to cut latency and cost. Both accept first/last frames plus prompts.',
      },
      {
        question: 'How many frames can I upload?',
        answer:
          'Provide exactly two frames: starting and ending. Use the prompt to describe how the motion should evolve between them.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 440,
      durationSeconds: 8,
      resolution: '1080p',
      label: 'Standard',
    },
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
      amountCents: 168,
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
      amountCents: 126,
      durationSeconds: 5,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'Scene 1: wide city skyline at dusk. Scene 2: close-up of neon reflections in rain. Scene 3: slow-motion walk through the alley, ambient audio.',
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
    availability: 'waitlist',
    logoPolicy: 'textOnly',
    billingNote: 'Available on fal.ai February 24, 2026. Pricing will be confirmed at launch.',
    engine: SEEDANCE_2_0_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/seedance-2.0/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10, 15], default: 10 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          notes: 'Coming soon on fal.ai. Native audio with up to 15s multi-shot generation.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/seedance-2.0/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10, 15], default: 10 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Supports multimodal references at launch (images, video clips, audio clips).',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/seedance-2.0/text-to-video',
    seo: {
      title: 'Seedance 2.0 on fal.ai — AI Video with Native Audio (Feb 24)',
      description:
        'Seedance 2.0 by ByteDance: cinematic AI video with native audio, realistic physics, and director-level camera control. Coming to fal.ai Feb 24, 2026.',
      canonicalPath: '/models/seedance-2-0',
    },
    type: 'textImage',
    seoText:
      'Seedance 2.0 is coming to fal.ai on February 24, 2026 with multimodal text, image, audio, and video references, native audio generation, and up to 15s multi-shot outputs.',
    prompts: [
      {
        title: 'Action chase prelaunch test',
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
    ],
    faqs: [
      {
        question: 'When is Seedance 2.0 available on fal.ai?',
        answer:
          'Seedance 2.0 is marked as available on fal.ai on February 24, 2026. Until then it is visible in pre-launch mode.',
      },
      {
        question: 'Can I run Seedance 2.0 before launch?',
        answer:
          'No. Runtime generation is locked before launch even though the model page is indexable.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Pricing confirmed at launch',
    },
    promptExample:
      'Three-shot cinematic sequence, 15 seconds total, director-style camera language, realistic physics, synchronized dialogue and ambience, 16:9.',
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
      amountCents: 24,
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
      amountCents: 36,
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
];

export function listFalEngines(): FalEngineEntry[] {
  return FAL_ENGINE_REGISTRY.slice();
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

export function getFalEngineBySlug(slug: string): FalEngineEntry | undefined {
  return FAL_ENGINE_REGISTRY.find((entry) => entry.modelSlug === slug);
}
