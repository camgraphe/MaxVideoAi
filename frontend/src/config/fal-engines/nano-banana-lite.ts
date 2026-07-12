import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const NANO_BANANA_LITE_ASPECT_RATIOS = [
  'auto',
  '1:1',
  '3:2',
  '2:3',
  '3:4',
  '4:3',
  '4:5',
  '5:4',
  '9:16',
  '16:9',
  '21:9',
] as const;

const NANO_BANANA_LITE_ENGINE: EngineCaps = {
  id: 'nano-banana-lite',
  label: 'Nano Banana Lite',
  provider: 'Google',
  version: 'Lite',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 4,
  resolutions: ['1k'],
  aspectRatios: [...NANO_BANANA_LITE_ASPECT_RATIOS],
  fps: [1],
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
        description: 'Describe the still image or local edit you want Nano Banana Lite to create.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Number of images',
        min: 1,
        max: 4,
        step: 1,
        default: 1,
        description: 'Generate up to 4 fast 1K images by running multiple direct provider calls.',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Add 1-14 source images for fast local edits and object-consistency workflows.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 14,
        source: 'either',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1k'],
        default: '1k',
        description: 'Nano Banana Lite supports 1K output only.',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...NANO_BANANA_LITE_ASPECT_RATIOS],
        default: 'auto',
      },
      {
        id: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: ['jpeg', 'png', 'webp'],
        default: 'jpeg',
      },
      {
        id: 'thinking_level',
        type: 'enum',
        label: 'Thinking level',
        values: ['minimal', 'high'],
        default: 'minimal',
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
      default: 3,
      byResolution: {
        '1k': 3,
      },
    },
    flatCents: {
      default: 3,
      byResolution: {
        '1k': 3,
      },
    },
  },
  pricing: {
    unit: 'image',
    base: 0.03,
    byResolution: {
      '1k': 0.03,
    },
    currency: 'USD',
    notes: 'Fast 1K direct provider route for high-volume still generation and edits.',
  },
  updatedAt: '2026-06-30T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google_vertex_image',
    modelSlug: 'gemini-3.1-flash-lite-image',
  },
  availability: 'available',
  brandId: 'google',
};

export const NANO_BANANA_LITE_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'nano-banana-lite',
    marketingName: 'Nano Banana Lite',
    cardTitle: 'Nano Banana Lite',
    provider: 'Google',
    brandId: 'google',
    versionLabel: 'Lite',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'Fast direct Google route for 1K image generation and editing.',
    engine: NANO_BANANA_LITE_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'gemini-3.1-flash-lite-image',
        ui: {
          modes: ['t2i'],
          aspectRatio: [...NANO_BANANA_LITE_ASPECT_RATIOS],
          resolution: ['1k'],
          notes: 'Fast 1K generation for high-volume image drafts, social concepts, and local edits.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'gemini-3.1-flash-lite-image',
        ui: {
          modes: ['i2i'],
          aspectRatio: [...NANO_BANANA_LITE_ASPECT_RATIOS],
          resolution: ['1k'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Edit with up to 14 references at 1K without Search grounding.',
        },
      },
    ],
    defaultFalModelId: 'gemini-3.1-flash-lite-image',
    seo: {
      title: 'Nano Banana Lite - Fast Google Image Generation | MaxVideoAI',
      description:
        'Use Nano Banana Lite in MaxVideoAI for fast 1K Google image generation and local edits with direct provider routing.',
      canonicalPath: '/models/nano-banana-lite',
    },
    type: 'image',
    seoText:
      'Nano Banana Lite is the fast 1K member of the Google Nano Banana image family, tuned for quick still-image drafts, social visuals, local edits, and high-volume creative iteration.',
    media: {
      videoUrl: '/assets/model-examples/nano-banana-lite/hero.webp',
      imagePath: '/assets/model-examples/nano-banana-lite/hero.webp',
      altText: 'Nano Banana Lite fast image generation example',
    },
    prompts: [
      {
        title: 'Fast editorial social frame',
        prompt:
          '1K kinetic editorial still of a night market cyclist passing through neon steam, sharp motion freeze, strong color contrast, bold empty space for social copy.',
        mode: 't2i',
        notes: 'Use Lite when speed matters more than 4K finishing.',
      },
      {
        title: 'Reference color swap',
        prompt:
          'Keep the subject, pose, and framing from this reference, but replace the jacket with a glossy red technical shell and shift the background to blue hour city lights.',
        mode: 'i2i',
      },
    ],
    faqs: [
      {
        question: 'What resolution does Nano Banana Lite support?',
        answer:
          'Nano Banana Lite is a 1K-only image generation and editing model. Use Nano Banana 2 or Nano Banana Pro when you need 2K or 4K output.',
      },
      {
        question: 'Does Nano Banana Lite support Google Search grounding?',
        answer:
          'No. Lite is optimized for fast image generation and local edits. Use Nano Banana 2 or Nano Banana Pro for Search-grounded image workflows.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 3,
      resolution: '1k',
      label: 'Per 1K image',
    },
    promptExample:
      '1K energetic street-fashion still at night, reflective rain, cyan and amber neon, dynamic low camera angle, editorial magazine lighting.',
  },
];
