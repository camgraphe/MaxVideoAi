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
  maxDurationSec: 8,
  resolutions: ['1080p'],
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
        values: ['5', '8'],
        default: '5',
        min: 5,
        max: 8,
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
    notes: '$0.20 per 5s at 720p, $0.45 per 5s at 1080p',
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
      default: 12,
      byResolution: {
        '720p': 12,
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
  availability: 'waitlist',
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
    availability: 'waitlist',
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
          duration: { options: [5, 8], default: 5 },
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
          duration: { options: [5, 8], default: 5 },
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
      'Create fast, fun, stylized AI videos with Pika. Ideal for 3–5 second animations in vertical or square formats—no audio, fast rendering, high visual impact.',
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
    id: 'minimax-hailuo-02-text',
    modelSlug: 'minimax-hailuo-02-text',
    marketingName: 'MiniMax Hailuo 02 Standard (Text & Image to Video)',
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
    id: 'nano-banana',
    modelSlug: 'nano-banana',
    marketingName: 'Nano Banana (Image Generation)',
    cardTitle: 'Nano Banana',
    provider: 'Google',
    brandId: 'google',
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
    type: 'Image · Text & Edit',
    seoText:
      'Bring your existing MaxVideoAI workflow to still imagery. Nano Banana covers both text-to-image runs and prompt-driven edits from the same prompt lab, wallet, and logging stack.',
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
