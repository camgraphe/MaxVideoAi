import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

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
      minImageSidePx: 300,
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


export const KLING_2_5_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'kling-2-5-turbo',
    marketingName: 'Kling 2.5 Turbo',
    cardTitle: 'Kling 2.5 Turbo',
    provider: 'Kling by Kuaishou',
    brandId: 'kling',
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
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/c38daf6b-b998-4bed-9ef9-da9fe662d709.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/c38daf6b-b998-4bed-9ef9-da9fe662d709.mp4',
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
];
