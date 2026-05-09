import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

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


export const KLING_2_6_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
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
          resolutionLocked: true,
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
          resolutionLocked: true,
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
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/0d3ad62a-2594-4bf7-ab5f-f34c784bc9cf.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/4db8923c-6762-47af-a0bd-5d50c28842f6-job_45f1fe48-ed93-452d-819b-9b956cd2d489.jpg',
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
];
