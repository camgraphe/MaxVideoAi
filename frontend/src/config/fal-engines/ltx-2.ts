import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

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
    notes: '$0.39 per 5s @1080p, $0.78 @1440p, $1.56 @4K',
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


export const LTX_2_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
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
    isLegacy: true,
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
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/cd143fa1-9dca-44ad-98ca-506452d5fd34.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/cd143fa1-9dca-44ad-98ca-506452d5fd34.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/f397ab6d-d0ef-44eb-977a-3419f494d17e-job_cda079d3-9895-45a0-866c-2dbf57593463.jpg',
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
      amountCents: 47,
      durationSeconds: 6,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'A cowboy walking through a dusty town at high noon, camera following from behind, cinematic depth, realistic lighting, western mood, 4K film grain.',
  },
];
