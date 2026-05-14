import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const NANO_BANANA_2_ENGINE: EngineCaps = {
  id: 'nano-banana-2',
  label: 'Nano Banana 2',
  provider: 'Google',
  version: '2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 4,
  resolutions: ['0.5k', '1k', '2k', '4k'],
  aspectRatios: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
  fps: [1],
  audio: false,
  upscale4k: true,
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
        description: 'Describe the still you want to generate or the edit you want applied.',
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
        description: 'Generate up to 4 images per request.',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Add 1-14 reference images for edit mode.',
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
        values: ['0.5k', '1k', '2k', '4k'],
        default: '1k',
        description: '0.5K is the entry draft tier, with 1K, 2K, and 4K available for higher-resolution stills.',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
        default: 'auto',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Reuse a seed to iterate on the same composition.',
      },
      {
        id: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: ['jpeg', 'png', 'webp'],
        default: 'jpeg',
      },
      {
        id: 'enable_web_search',
        type: 'boolean',
        label: 'Enable web search',
        default: false,
        description: 'Optional web grounding is quoted before generation.',
      },
      {
        id: 'thinking_level',
        type: 'enum',
        label: 'Thinking level',
        values: ['minimal', 'high'],
        default: 'minimal',
      },
      {
        id: 'limit_generations',
        type: 'boolean',
        label: 'Limit generations',
        default: false,
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
      default: 8,
      byResolution: {
        '0.5k': 4,
        '1k': 8,
        '2k': 12,
        '4k': 16,
      },
    },
    flatCents: {
      default: 8,
      byResolution: {
        '0.5k': 4,
        '1k': 8,
        '2k': 12,
        '4k': 16,
      },
    },
    addons: {
      enable_web_search: {
        flatCents: 1.5,
      },
    },
  },
  pricing: {
    unit: 'image',
    base: 0.08,
    byResolution: {
      '0.5k': 0.04,
      '1k': 0.08,
      '2k': 0.12,
      '4k': 0.16,
    },
    addons: {
      enable_web_search: {
        flat: 0.015,
      },
    },
    currency: 'USD',
    notes: 'Raw provider pricing is converted to MaxVideoAI display pricing before the live quote is shown.',
  },
  updatedAt: '2026-03-17T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'fal.ai',
    modelSlug: 'fal-ai/nano-banana-2',
  },
  availability: 'available',
  brandId: 'google',
};


export const NANO_BANANA_2_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'nano-banana-2',
    modelSlug: 'nano-banana-2',
    marketingName: 'Nano Banana 2',
    cardTitle: 'Nano Banana 2',
    provider: 'Google',
    brandId: 'google',
    family: 'nano-banana',
    versionLabel: '2',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'MaxVideoAI display pricing starts at $0.06 for 0.5K, $0.11 for 1K, $0.16 for 2K, and $0.21 for 4K before optional settings.',
    engine: NANO_BANANA_2_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'fal-ai/nano-banana-2',
        ui: {
          modes: ['t2i'],
          aspectRatio: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
          resolution: ['0.5k', '1k', '2k', '4k'],
          notes: 'Balanced quality, broader aspect ratios, and optional web-grounded image generation.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'fal-ai/nano-banana-2/edit',
        ui: {
          modes: ['i2i'],
          aspectRatio: ['auto', '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16', '4:1', '1:4', '8:1', '1:8'],
          resolution: ['0.5k', '1k', '2k', '4k'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Edit with up to 14 reference images and optional web grounding.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/nano-banana-2',
    seo: {
      title: 'Nano Banana 2 – Google Image Generation & Editing | MaxVideoAI',
      description:
        'Use Nano Banana 2 in MaxVideoAI for fast 0.5K to 4K still generation, wide and extreme aspect ratios, semantic editing, and optional web-grounded image prompts.',
      canonicalPath: '/models/nano-banana-2',
    },
    type: 'image',
    seoText:
      'Nano Banana 2 expands the MaxVideoAI image workspace with lower-cost drafts, broader aspect ratios, advanced output controls, optional web-grounded prompting, and support for larger multi-image edit sets.',
    media: {
      videoUrl: 'https://media.maxvideoai.com/marketing/marketing/2e71a814-3eed-4965-8beb-bd22d1c243e4.png',
      imagePath: 'https://media.maxvideoai.com/marketing/marketing/2e71a814-3eed-4965-8beb-bd22d1c243e4.png',
      altText: 'Nano Banana 2 sample image preview',
    },
    prompts: [
      {
        title: 'Ultra-wide concept frame',
        prompt:
          '8:1 panoramic concept art of a futuristic desert transit hub at sunrise, long shadows, reflective glass, disciplined signage system, editorial realism.',
        mode: 't2i',
        notes: 'Use 0.5K or 1K for fast framing passes before locking finals.',
      },
      {
        title: 'Grounded product scene',
        prompt:
          'Create a premium skincare launch still informed by current high-end retail display trends, soft daylight, pale stone surfaces, minimal serif packaging, polished campaign mood.',
        mode: 't2i',
        notes: 'Enable web search when you want current visual references to influence the brief.',
      },
      {
        title: 'Multi-reference edit',
        prompt:
          'Combine these reference images into one cohesive campaign still: preserve the bag silhouette, keep the studio lighting direction, unify the palette, and clean up distracting reflections.',
        mode: 'i2i',
        notes: 'Upload multiple references to lock materials, composition cues, and color treatment.',
      },
    ],
    faqs: [
      {
        question: 'What resolutions does Nano Banana 2 support?',
        answer:
          'You can render still images at 0.5K, 1K, 2K, and 4K. MaxVideoAI display pricing starts at $0.06 for 0.5K, $0.11 for 1K, $0.16 for 2K, and $0.21 for 4K.',
      },
      {
        question: 'Is Nano Banana 2 for still images or video?',
        answer:
          'Nano Banana 2 is for still images only on MaxVideoAI. It supports text-to-image generation and image-to-image edits, not video or audio renders.',
      },
      {
        question: 'When should I use Nano Banana 2 instead of Nano Banana Pro?',
        answer:
          'Use Nano Banana 2 for grounded image generation, lower-cost draft passes, wide ratios, and multi-reference edits. Use Nano Banana Pro when typography polish and 4K campaign finals matter more.',
      },
      {
        question: 'Does Nano Banana 2 support multi-image edits?',
        answer:
          'Yes. The edit route accepts up to 14 reference images, which is useful for product consistency, moodboards, and controlled semantic edits.',
      },
      {
        question: 'What does web search do?',
        answer:
          'Web search lets the model ground the request with current web context when you need fresher references. It adds a small flat request fee on top of image pricing.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 8,
      resolution: '1k',
      label: 'Per 1K image',
    },
    promptExample:
      '1K editorial still of a boutique hotel lobby at blue hour, polished travertine, warm sconces, clean signage, realistic reflections, premium travel-magazine look.',
    category: 'image',
  },
];
