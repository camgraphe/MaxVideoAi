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
  label: 'Pika 2.2 Text to Video',
  provider: 'Pika',
  version: '2.2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
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
    ],
    optional: [
      {
        id: 'duration_seconds',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '8'],
        default: '5',
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

const PIKA_IMAGE_TO_VIDEO_ENGINE: EngineCaps = {
  id: 'pika-image-to-video',
  label: 'Pika 2.2 Image to Video',
  provider: 'Pika',
  version: '2.2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['i2v'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {},
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
        label: 'Source image',
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
    modelSlug: 'fal-ai/pika/v2.2/image-to-video',
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
  modes: ['i2v'],
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
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 4,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['8s'],
        default: '8s',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
        default: '720p',
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
      byResolution: {
        '720p': 40,
        '1080p': 55,
      },
    },
    addons: {
      audio_off: {
        perSecondCents: -13,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.4,
    currency: 'USD',
    notes: '$0.40/s with audio, ~33% less with audio disabled',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google-veo',
    modelSlug: 'fal-ai/veo3.1/reference-to-video',
  },
  availability: 'available',
  brandId: 'google-veo',
};

const VEO_3_FAST_ENGINE: EngineCaps = {
  id: 'veo-3-fast',
  label: 'Google Veo 3 Fast',
  provider: 'Google',
  version: '3 Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {},
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
        values: ['4s', '6s', '8s'],
        default: '8s',
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
      },
    ],
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 40,
      byResolution: {
        '720p': 40,
        '1080p': 50,
      },
    },
    addons: {
      audio_off: {
        perSecondCents: -15,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.4,
    currency: 'USD',
    notes: '$0.40/s with audio, about $0.25/s with audio off',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google-veo',
    modelSlug: 'fal-ai/veo3/fast',
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
  modes: ['i2v'],
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
        id: 'first_frame_url',
        type: 'image',
        label: 'First frame',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'last_frame_url',
        type: 'image',
        label: 'Last frame',
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
        values: ['8s'],
        default: '8s',
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
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 15,
      byResolution: {
        '720p': 10,
        '1080p': 15,
      },
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
    modelSlug: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
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
  resolutions: ['auto', '720p'],
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
        values: ['auto', '720p'],
        default: 'auto',
      },
      {
        id: 'api_key',
        type: 'text',
        label: 'OpenAI API key',
        description: 'Use your own key for direct OpenAI billing',
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
        auto: 10,
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
        id: 'api_key',
        type: 'text',
        label: 'OpenAI API key',
        description: 'Bring your own OpenAI key for direct billing.',
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

const HAILUO_TEXT_ENGINE: EngineCaps = {
  id: 'minimax-hailuo-02-text',
  label: 'MiniMax Hailuo 02 Standard (Text to Video)',
  provider: 'MiniMax',
  version: 'Standard',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v'],
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
  inputLimits: {},
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
        values: ['6', '10'],
        default: '6',
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
      },
    ],
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

const HAILUO_IMAGE_ENGINE: EngineCaps = {
  id: 'minimax-hailuo-02-image',
  label: 'MiniMax Hailuo 02 Standard (Image to Video)',
  provider: 'MiniMax',
  version: 'Standard',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['i2v'],
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
        label: 'Source image',
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
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['512P', '768P'],
        default: '768P',
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
    notes: '$0.045/s with reference support',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'minimax',
    modelSlug: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
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
    billingNote: 'Si une cle OpenAI est fournie, la facturation passe directement chez OpenAI ; sinon Fal credite MaxVideoAI.',
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
          notes: 'Optional OpenAI API key routes billing directly through OpenAI.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/sora-2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['auto', '720p'],
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
      {
        question: 'How does billing work with FAL credits or my OpenAI API key?',
        answer:
          'MaxVideo AI routes Sora 2 runs through FAL by default. Drop your own OpenAI API key in the app to bill usage directly through OpenAI—the interface keeps showing an indicative rate and adds a "Billed by OpenAI" badge so finance teams stay aligned.',
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
    billingNote:
      'Requires Sora Pro allocation. Provide an OpenAI API key to bill directly with OpenAI or use Fal routing credits.',
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
        question: 'Can I use my own OpenAI key with Sora 2 Pro?',
        answer:
          'Yes. Enter your OpenAI API key before you render and billing is handled on your OpenAI account while MaxVideo routes the job.',
      },
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
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/reference-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/reference-to-video',
    seo: {
      title: 'Veo 3.1 – Advanced Text-to-Video & Native Audio Engine',
      description:
        'Generate cinematic 8-second videos with native audio using Veo 3.1 by Google DeepMind on MaxVideoAI. Reference-to-video guidance, multi-image fidelity, pay-as-you-go pricing from $0.52/s.',
      canonicalPath: '/models/veo-3-1',
    },
    type: 'Image only',
    demoUrl: 'https://v3b.fal.media/files/b/kangaroo/oUCiZjQwEy6bIQdPUSLDF_output.mp4',
    media: {
      videoUrl: 'https://storage.googleapis.com/falserverless/example_outputs/veo3-i2v-output.mp4',
      imagePath: '/hero/veo3.jpg',
      altText: 'Demo video generated with Veo 3.1',
    },
    prompts: [
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
    id: 'veo-3-fast',
    modelSlug: 'veo-3-fast',
    marketingName: 'Google Veo 3 Fast',
    cardTitle: 'Veo 3 Fast',
    provider: 'Google',
    brandId: 'google-veo',
    family: 'veo',
    versionLabel: '3 Fast',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: VEO_3_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/veo3/fast',
        ui: {
          modes: ['t2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3/fast',
    seo: {
      title: 'Veo 3 Fast – Quick Cinematic Video Generation (No Audio)',
      description:
        'Generate cinematic-style AI videos in seconds using Veo 3 Fast. Optimized for speed, silent playback, and low-cost prototyping via MaxVideoAI.',
      canonicalPath: '/models/veo-3-fast',
    },
    type: 'Text only · Silent',
    seoText:
      'Test cinematic prompts quickly with Veo 3 Fast. No audio, up to 8s, ultra-fast generation for storyboarding and social loops.',
    demoUrl: 'https://v3.fal.media/files/lion/L9nkXSW1MCj2oDimeJ4w5_output.mp4',
    media: {
      videoUrl: 'https://v3.fal.media/files/lion/L9nkXSW1MCj2oDimeJ4w5_output.mp4',
      imagePath: '/hero/veo3.jpg',
      altText: 'Short clip generated with Veo 3 Fast',
    },
    prompts: [
      {
        title: 'Frozen lake cinematic test',
        prompt: 'A lone astronaut walking across a frozen lake at sunset, cinematic wide shot with reflective ice, slow pan left, no audio mentioned.',
        mode: 't2v',
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
      amountCents: 80,
      durationSeconds: 8,
      resolution: '720p',
      label: 'Silent clip',
    },
    promptExample:
      'A futuristic corridor with flickering neon lights, camera slowly tracks forward, shadows moving on the walls',
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
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '9:16', '16:9', '1:1'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 12,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/fast/first-last-frame-to-video',
    seo: {
      title: 'Veo 3.1 Fast – High-Speed AI Video Generation (with or without Audio)',
      description:
        'Use Veo 3.1 Fast for affordable, fast AI video generation. Up to 8-second clips with optional native audio—ideal for social formats and iterative testing.',
      canonicalPath: '/models/veo-3-1-fast',
    },
    type: 'Text only',
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
        title: 'Misty forest zoom',
        prompt: 'A misty forest at dawn, camera slowly zooms in on a mossy rock, sun rays piercing through trees, optional ambient birdsong.',
        mode: 'i2v',
        notes: 'Enable audio for subtle ambience or leave it off for silent loops.',
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
    id: 'pika-text-to-video',
    modelSlug: 'pika-text-to-video',
    marketingName: 'Pika 2.2 Text to Video',
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
    ],
    defaultFalModelId: 'fal-ai/pika/v2.2/text-to-video',
    seo: {
      title: 'Pika Text-to-Video – Stylized AI Video from Prompts',
      description:
        'Generate creative, animated AI videos from text prompts using Pika. Perfect for short-form, stylized visuals without audio via MaxVideoAI.',
      canonicalPath: '/models/pika-text-to-video',
    },
    type: 'Text only · Stylized',
    seoText:
      'Create fast, fun, stylized AI videos with Pika. Ideal for 3–5 second animations in vertical or square formats—no audio, fast rendering, high visual impact.',
    demoUrl: 'https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4',
    media: {
      videoUrl: 'https://storage.googleapis.com/falserverless/web-examples/pika/pika%202.2/pika22_output.mp4',
      imagePath: '/hero/pika-22.jpg',
      altText: 'Stylized short clip made with Pika (text-to-video)',
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
    id: 'pika-image-to-video',
    modelSlug: 'pika-image-to-video',
    marketingName: 'Pika 2.2 Image to Video',
    cardTitle: 'Pika 2.2',
    provider: 'Pika',
    brandId: 'pika',
    family: 'pika',
    versionLabel: '2.2',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: PIKA_IMAGE_TO_VIDEO_ENGINE,
    modes: [
      {
        mode: 'i2v',
        falModelId: 'fal-ai/pika/v2.2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 8], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 20,
          audioToggle: false,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/pika/v2.2/image-to-video',
    seo: {
      title: 'Pika Image-to-Video – Animate Any Still Frame with AI',
      description:
        'Turn a static image into a dynamic video using Pika. Add motion, zooms, and stylized transitions—silent clips perfect for loops and product shots.',
      canonicalPath: '/models/pika-image-to-video',
    },
    type: 'Image only · Stylized',
    seoText:
      'Turn still images into motion-rich video clips with Pika. Add zooms, pans or animation styles to any visual—fast and soundless for short loops and cutaways.',
    demoUrl: '/hero/pika-15.mp4',
    media: {
      videoUrl: '/hero/pika-15.mp4',
      imagePath: '/hero/pika-15.jpg',
      altText: 'Animated loop generated from still using Pika',
    },
    prompts: [
      {
        title: 'Fantasy castle drift',
        prompt: 'Zoom slowly into a fantasy castle on a cliff at sunset, birds glide by, anime art style with drifting clouds',
        mode: 'i2v',
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
      'Slow pan across a futuristic skyline at night, with fog and neon reflections, low poly style',
  },
  {
    id: 'minimax-hailuo-02-text',
    modelSlug: 'minimax-hailuo-02-text',
    marketingName: 'MiniMax Hailuo 02 Standard (Text to Video)',
    cardTitle: 'MiniMax Hailuo 02',
    provider: 'MiniMax',
    brandId: 'minimax',
    family: 'hailuo',
    versionLabel: 'Standard',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: HAILUO_TEXT_ENGINE,
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
        },
      },
    ],
    defaultFalModelId: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    seo: {
      title: 'MiniMax Hailuo 02 (Text-to-Video) – Fast, Stylized AI Generation',
      description:
        'Generate fast, stylized video from text prompts with MiniMax Hailuo 02. Ideal for testing motion concepts and short clips—silent and budget-friendly via MaxVideoAI.',
      canonicalPath: '/models/minimax-hailuo-02-text',
    },
    type: 'Text only · Stylized',
    seoText:
      'Generate stylized short video clips from text using MiniMax Hailuo 02. Fast, silent, and ideal for quick loops, visual tests, or motion studies.',
    demoUrl: '/hero/minimax-video01.mp4',
    media: {
      videoUrl: '/hero/minimax-video01.mp4',
      imagePath: '/hero/minimax-video01.jpg',
      altText: 'Fast stylized motion demo from text prompt',
    },
    prompts: [
      {
        title: 'Cinematic fox run',
        prompt: 'A stylized fox running through a windy forest, camera follows from behind, swirling leaves, cinematic depth of field',
        mode: 't2v',
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
    id: 'minimax-hailuo-02-image',
    modelSlug: 'minimax-hailuo-02-image',
    marketingName: 'MiniMax Hailuo 02 Standard (Image to Video)',
    cardTitle: 'MiniMax Hailuo 02',
    provider: 'MiniMax',
    brandId: 'minimax',
    family: 'hailuo',
    versionLabel: 'Standard',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: HAILUO_IMAGE_ENGINE,
    modes: [
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
        },
      },
    ],
    defaultFalModelId: 'fal-ai/minimax/hailuo-02/standard/image-to-video',
    seo: {
      title: 'MiniMax Hailuo 02 (Image-to-Video) – Animate Any Visual in Seconds',
      description:
        'Transform static images into animated motion with MiniMax Hailuo 02. Add subtle movement, zooms, or stylization—silent loops ready for creative workflows.',
      canonicalPath: '/models/minimax-hailuo-02-image',
    },
    type: 'Image only · Stylized',
    seoText:
      'Bring static visuals to life with MiniMax Hailuo 02’s image-to-video engine. Add motion, zoom, or stylized animation to renders and artwork—no sound, fast turnaround.',
    demoUrl: '/hero/minimax-video01.mp4',
    media: {
      videoUrl: '/hero/minimax-video01.mp4',
      imagePath: '/hero/minimax-video01.jpg',
      altText: 'Animation sample from image with MiniMax',
    },
    prompts: [
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
      'Zoom into a desert landscape at twilight, blowing sand and glowing horizon, cinematic style',
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
