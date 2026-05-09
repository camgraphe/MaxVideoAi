import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

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
    notes: 'Provider cost: $0.084/s audio off, $0.126/s audio on, $0.154/s voice control. MaxVideoAI display prices add platform margin before showing quotes.',
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


export const KLING_3_STANDARD_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
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
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/0d3ad62a-2594-4bf7-ab5f-f34c784bc9cf.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4db8923c-6762-47af-a0bd-5d50c28842f6-job_45f1fe48-ed93-452d-819b-9b956cd2d489.jpg',
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
];
