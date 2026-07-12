import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const HAILUO_ENGINE: EngineCaps = {
  id: 'minimax-hailuo-02-text',
  label: 'MiniMax Hailuo 02 Standard',
  provider: 'MiniMax',
  version: 'Standard',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
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
        label: 'Duration',
        values: ['6', '10'],
        default: '6',
        min: 6,
        max: 10,
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
        modes: ['t2v'],
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


export const HAILUO_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'minimax-hailuo-02-text',
    marketingName: 'MiniMax Hailuo 02 Standard',
    cardTitle: 'MiniMax Hailuo 02',
    provider: 'MiniMax',
    brandId: 'minimax',
    versionLabel: 'Standard',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: HAILUO_ENGINE,
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
          notes: 'Enable the prompt optimiser toggle for longer scripts.',
        },
      },
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
          notes: 'Upload an optional end frame if you need the shot to land on a specific still.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
    seo: {
      title: 'MiniMax Hailuo 02 – Stylized Text & Image to Video',
      description:
        'Generate fast, stylized motion from prompts or animate uploaded stills with MiniMax Hailuo 02. Ideal for testing motion concepts, loops, and storyboard passes—silent and budget-friendly via MaxVideoAI.',
      canonicalPath: '/models/minimax-hailuo-02-text',
    },
    type: 'Text + Image · Stylized',
    seoText:
      'Generate stylized short clips from text or breathe life into stills using MiniMax Hailuo 02. Fast, silent, and ideal for loops, visual tests, or motion studies.',
    demoUrl: '/hero/minimax-video01.mp4',
    media: {
      videoUrl: '/hero/minimax-video01.mp4',
      imagePath: '/hero/minimax-video01.jpg',
      altText: 'Fast stylized motion demo from MiniMax Hailuo 02',
    },
    prompts: [
      {
        title: 'Cinematic fox run',
        prompt: 'A stylized fox running through a windy forest, camera follows from behind, swirling leaves, cinematic depth of field',
        mode: 't2v',
      },
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
      'A glowing butterfly flying across a dark cave, dust particles in the air, camera slowly zooms out',
  },
];
