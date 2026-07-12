import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const LTX_2_FAST_ENGINE: EngineCaps = {
  id: 'ltx-2-fast',
  label: 'LTX Video 2.0 Fast',
  provider: 'Lightricks',
  version: '2.0 Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 20,
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
        values: ['6', '8', '10', '12', '14', '16', '18', '20'],
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
      default: 4,
      byResolution: {
        '1080p': 4,
        '1440p': 8,
        '4k': 16,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.04,
    byResolution: {
      '1080p': 0.04,
      '1440p': 0.08,
      '4k': 0.16,
    },
    currency: 'USD',
    notes: '$0.26 per 5s @1080p, $0.52 @1440p, $1.04 @4K',
  },
  updatedAt: '2025-03-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'lightricks',
    modelSlug: 'fal-ai/ltx-2/text-to-video/fast',
  },
  availability: 'available',
  brandId: 'lightricks',
};


export const LTX_2_FAST_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'ltx-2-fast',
    marketingName: 'LTX Video 2.0 Fast',
    cardTitle: 'LTX-2 Fast – Quick cinematic video with audio',
    provider: 'Lightricks',
    brandId: 'lightricks',
    versionLabel: 'Fast',
    availability: 'available',
    logoPolicy: 'textOnly',
    isLegacy: true,
    engine: LTX_2_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/ltx-2/text-to-video/fast',
        ui: {
          modes: ['t2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9'],
          audioToggle: true,
          notes: 'Native audio is on by default; 12–20s runs require 1080p at 25fps.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/ltx-2/image-to-video/fast',
        ui: {
          modes: ['i2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload one reference still; 12–20s runs require 1080p at 25fps.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/ltx-2/text-to-video/fast',
    seo: {
      title: 'LTX-2 Fast AI Video – Text & Image to Video with Audio | MaxVideoAI',
      description:
        'Generate fast cinematic AI videos with LTX-2 Fast. Text and image to video with synchronized audio, up to 4K, ideal for rapid iteration and social content.',
      canonicalPath: '/models/ltx-2-fast',
    },
    type: 'textImage',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/bb626d67-1a33-4088-ae1f-ccb99738eabc.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/bb626d67-1a33-4088-ae1f-ccb99738eabc.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/1bd62e34-0e55-4f49-b434-295276b991d4-job_d895c3b0-562a-4e36-ae06-4ce083a47126.jpg',
      altText: 'LTX-2 Fast sample: continuous walkthrough in a modern office',
    },
    prompts: [
      {
        title: 'Office walkthrough (one take)',
        prompt:
          '18–20 second 16:9 continuous shot that follows a team lead through a startup office. Camera glides from entrance to window, passing collaborators, plants and whiteboards under warm daylight with soft office ambience + light score.',
        mode: 't2v',
      },
      {
        title: 'Golden-hour crosswalk (8s)',
        prompt:
          'Handheld-style tracking shot at a busy crosswalk. Camera starts behind a woman with a backpack, then steps onto the street as warm sunlight flares across her face and cars pass in the background. Soft city ambience + upbeat music bed.',
        mode: 't2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 31,
      durationSeconds: 6,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      'A cowboy walking through a dusty town at high noon, camera following from behind, cinematic depth, realistic lighting, western mood, 4K film grain.',
  },
];
