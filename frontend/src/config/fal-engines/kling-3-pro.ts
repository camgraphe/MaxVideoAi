import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

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
    notes: 'Provider cost: $0.112/s audio off, $0.168/s audio on, $0.196/s voice control. MaxVideoAI display prices add platform margin before showing quotes.',
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


export const KLING_3_PRO_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
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
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/0d3ad62a-2594-4bf7-ab5f-f34c784bc9cf.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4db8923c-6762-47af-a0bd-5d50c28842f6-job_45f1fe48-ed93-452d-819b-9b956cd2d489.jpg',
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
];
