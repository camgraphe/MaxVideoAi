import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

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
      minImageSidePx: 300,
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


export const SEEDANCE_1_5_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-1-5-pro',
    marketingName: 'Seedance 1.5 Pro',
    cardTitle: 'Seedance 1.5 Pro – cinematic motion control',
    provider: 'ByteDance',
    brandId: 'bytedance',
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
];
