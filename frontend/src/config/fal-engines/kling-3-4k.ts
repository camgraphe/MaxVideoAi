import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

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
        label: 'Start frame',
        description: 'Used as the opening frame for Kling 3 4K image-to-video generation.',
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
    notes: 'Provider cost: $0.420/s native 4K output. MaxVideoAI display prices add platform margin before showing quotes.',
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


export const KLING_3_4K_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
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
          notes: 'Animate one start frame directly to native 4K output. Use Kling 3.0 Omni Reference when images should guide the shot without opening the clip.',
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
      'Kling 3 4K routes single prompts, multi-prompt shot plans, and image-to-video jobs to native 4K output for delivery-grade cinematic clips without a separate upscale step.',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/f85affe5-fee2-4c4b-b4af-f65903173194.mp4',
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
          'Animate the uploaded start frame into a native 4K slow push-in with clean subject edges, stable lighting, and polished final-frame composition.',
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
];
