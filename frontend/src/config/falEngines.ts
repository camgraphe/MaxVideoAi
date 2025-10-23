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

export interface FalEngineEntry {
  id: string;
  modelSlug: string;
  marketingName: string;
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
  prompts: FalEnginePromptHint[];
  faqs?: FalEngineFaqEntry[];
  pricingHint?: FalEnginePricingHint;
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

export const FAL_ENGINE_REGISTRY: FalEngineEntry[] = [
  {
    id: 'pika-text-to-video',
    modelSlug: 'pika-text-to-video',
    marketingName: 'Pika 2.2 Text to Video',
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
      title: 'Pika 2.2 Text to Video - MaxVideo AI',
      description: 'Social-first loops with caption overlays and fast iteration.',
      canonicalPath: '/models/pika-text-to-video',
    },
    prompts: [
      {
        title: 'Product loop',
        prompt: 'Macro studio shot of a perfume bottle rotating on a reflective surface, volumetric lighting, high contrast cinematic style',
        mode: 't2v',
      },
      {
        title: 'Motion graphic',
        prompt: 'Neon cyberpunk city skyline with animated typography revealing "Launch Day", moody purple and teal lighting',
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
      amountCents: 20,
      durationSeconds: 5,
      resolution: '720p',
    },
  },
  {
    id: 'pika-image-to-video',
    modelSlug: 'pika-image-to-video',
    marketingName: 'Pika 2.2 Image to Video',
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
      title: 'Pika 2.2 Image to Video - MaxVideo AI',
      description: 'Animate a still frame with stylised motion and camera moves.',
      canonicalPath: '/models/pika-image-to-video',
    },
    prompts: [
      {
        title: 'Storyboard still animation',
        prompt: 'Slow dolly-in on the provided illustration, gentle camera sway, cinematic depth of field',
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
      amountCents: 20,
      durationSeconds: 5,
      resolution: '720p',
    },
  },
  {
    id: 'veo-3-1',
    modelSlug: 'veo-3-1',
    marketingName: 'Google Veo 3.1',
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
      title: 'Google Veo 3.1 - MaxVideo AI',
      description: 'Reference-to-video control with multi-image subject guidance.',
      canonicalPath: '/models/veo-3-1',
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
      title: 'Google Veo 3 Fast - MaxVideo AI',
      description: 'Faster queue for previz while keeping the Veo look and audio toggle.',
      canonicalPath: '/models/veo-3-fast',
    },
    prompts: [
      {
        title: 'Storyboard draft',
        prompt: 'Fast previsualization of a drone reveal above a stadium, wide aerial, dusk lighting, dramatic clouds, cinematic grading',
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
      amountCents: 320,
      durationSeconds: 8,
      resolution: '720p',
    },
  },
  {
    id: 'veo-3-1-fast',
    modelSlug: 'veo-3-1-fast',
    marketingName: 'Google Veo 3.1 Fast',
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
      title: 'Google Veo 3.1 Fast - MaxVideo AI',
      description: 'Bridge a first and last frame in 8 seconds with optional audio.',
      canonicalPath: '/models/veo-3-1-fast',
    },
    prompts: [
      {
        title: 'Hero transition',
        prompt: 'Blend the uploaded start and end frames into a smooth eight second arc shot, keep product sharp, add subtle camera parallax',
        mode: 'i2v',
        notes: 'Use First frame and Last frame slots for the bookend stills.',
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
    },
  },
  {
    id: 'sora-2',
    modelSlug: 'sora-2',
    marketingName: 'OpenAI Sora 2',
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
      title: 'OpenAI Sora 2 - MaxVideo AI',
      description: 'Text-to-video and remix with native audio via Fal routing.',
      canonicalPath: '/models/sora-2',
    },
    prompts: [
      {
        title: 'Cinematic story beat',
        prompt: 'Aerial establishing shot of a coastal town at sunrise, soft golden light, gentle ocean haze, cinematic camera move',
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
      amountCents: 40,
      durationSeconds: 4,
      resolution: '720p',
    },
  },
  {
    id: 'sora-2-pro',
    modelSlug: 'sora-2-pro',
    marketingName: 'OpenAI Sora 2 Pro',
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
      title: 'OpenAI Sora 2 Pro - MaxVideo AI',
      description: 'Cinematic video with synced dialogue, higher resolutions, and image-to-video control for premium teams.',
      canonicalPath: '/models/sora-2-pro',
    },
    prompts: [
      {
        title: 'Cinematic dialogue break-up',
        prompt:
          'A dramatic Hollywood breakup scene at dusk on a quiet suburban street. A man and a woman in their 30s face each other, speaking softly but emotionally, lips syncing to breakup dialogue. Cinematic lighting, warm sunset tones, shallow depth of field, gentle breeze moving autumn leaves, realistic natural sound, no background music',
        mode: 't2v',
        notes: 'Render at 1080p for close-up facial fidelity.',
      },
      {
        title: 'Skydiving POV testimonial',
        prompt:
          "Front-facing 'invisible' action-cam on a skydiver in freefall above bright clouds; camera locked on his face. He speaks over the wind with clear lipsync: 'This is insanely fun! You've got to try it—book a tandem and go!' Natural wind roar, voice close-mic'd and slightly compressed so it's intelligible. Midday sun, goggles and jumpsuit flutter, altimeter visible, parachute rig on shoulders. Energetic but stable framing with subtle shake; brief horizon roll. End on first tug of canopy and wind noise dropping.",
        mode: 'i2v',
        notes: 'Start from a 1080p still to let Sora Pro maintain crisp details through the motion.',
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
      amountCents: 400,
      durationSeconds: 8,
      resolution: '1080p',
      label: 'Pro tier',
    },
  },
  {
    id: 'minimax-hailuo-02-text',
    modelSlug: 'minimax-hailuo-02-text',
    marketingName: 'MiniMax Hailuo 02 Standard (Text to Video)',
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
      title: 'MiniMax Hailuo 02 Standard - MaxVideo AI',
      description: 'Prompt optimiser-enabled drafts before the hero render.',
      canonicalPath: '/models/minimax-hailuo-02-text',
    },
    prompts: [
      {
        title: 'Stylised narrative',
        prompt: 'Animated brush stroke style telling a product origin story, dynamic camera pans, warm palette, add subtle film grain',
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
      amountCents: 27,
      durationSeconds: 6,
      resolution: '768P',
    },
  },
  {
    id: 'minimax-hailuo-02-image',
    modelSlug: 'minimax-hailuo-02-image',
    marketingName: 'MiniMax Hailuo 02 Standard (Image to Video)',
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
      title: 'MiniMax Hailuo 02 Standard Image to Video - MaxVideo AI',
      description: 'Reference image to motion with optional end frame.',
      canonicalPath: '/models/minimax-hailuo-02-image',
    },
    prompts: [
      {
        title: 'End frame handoff',
        prompt: 'Turn the uploaded key visual into a looping hero shot, maintain typography, integrate optional end frame for reveal',
        mode: 'i2v',
        notes: 'Upload the optional End frame to control the final pose.',
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
      amountCents: 27,
      durationSeconds: 6,
      resolution: '768P',
    },
  },
];

export function listFalEngines(): FalEngineEntry[] {
  return FAL_ENGINE_REGISTRY.slice();
}

export function getFalEngineById(id: string): FalEngineEntry | undefined {
  return FAL_ENGINE_REGISTRY.find((entry) => entry.id === id);
}

export function getFalEngineBySlug(slug: string): FalEngineEntry | undefined {
  return FAL_ENGINE_REGISTRY.find((entry) => entry.modelSlug === slug);
}
