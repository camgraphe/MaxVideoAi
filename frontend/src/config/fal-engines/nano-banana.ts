import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const NANO_BANANA_ENGINE: EngineCaps = {
  id: 'nano-banana',
  label: 'Nano Banana',
  provider: 'Google',
  version: 'Nano',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 8,
  resolutions: ['square_hd', 'landscape_hd', 'portrait_hd'],
  aspectRatios: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
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
        description: 'Describe what you want Nano Banana to create.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Number of images',
        min: 1,
        max: 8,
        step: 1,
        default: 1,
        description: 'Batch size per call (max 8).',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['t2i'],
        values: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: '1:1',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['i2i'],
        values: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: 'auto',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Image inputs',
        description: 'Provide source images when using Edit mode.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 4,
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
    flatCents: {
      default: 4,
    },
  },
  pricing: {
    unit: 'image',
    base: 0.039,
    currency: 'USD',
    notes: '$0.039 per generated image',
  },
  updatedAt: '2025-03-01T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'fal.ai',
    modelSlug: 'fal-ai/nano-banana',
  },
  availability: 'available',
  brandId: 'google',
};


export const NANO_BANANA_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'nano-banana',
    modelSlug: 'nano-banana',
    marketingName: 'Nano Banana (Image Generation)',
    cardTitle: 'Nano Banana',
    provider: 'Google',
    brandId: 'google',
    family: 'nano-banana',
    versionLabel: 'Nano',
    availability: 'available',
    isLegacy: true,
    logoPolicy: 'textOnly',
    billingNote: '$0.039 per image via managed queue',
    engine: NANO_BANANA_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'fal-ai/nano-banana',
        ui: {
          modes: ['t2i'],
          aspectRatio: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          notes: 'Launch up to 8 high-quality renders from one prompt.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'fal-ai/nano-banana/edit',
        ui: {
          modes: ['i2i'],
          aspectRatio: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Upload 1–4 references to remix or extend shots.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/nano-banana',
    seo: {
      title: 'Nano Banana – Google Text-to-Image on MaxVideoAI',
      description:
        'Generate photoreal stills or remix reference shots with Nano Banana, the Google-powered image model available with MaxVideoAI credits.',
      canonicalPath: '/models/nano-banana',
    },
    type: 'image',
    seoText:
      'Bring your existing MaxVideoAI workflow to still imagery. Nano Banana covers both text-to-image runs and prompt-driven edits from the same prompt lab, wallet, and logging stack.',
    media: {
      videoUrl: '/hero/pika-22.mp4',
      imagePath: 'https://media.maxvideoai.com/marketing/marketing/2e71a814-3eed-4965-8beb-bd22d1c243e4.png',
      altText: 'Nano Banana image preview',
    },
    prompts: [
      {
        title: 'Stylized action still',
        prompt:
          'Action shot of a black lab leaping through a suburban pool at golden hour, water droplets frozen mid-air, 85mm lens flare.',
        mode: 't2i',
        notes: 'Batch 3 variants to explore composition tweaks.',
      },
      {
        title: 'Reference remix',
        prompt:
          'Turn this studio portrait into a moody cyberpunk scene with neon rim lights and rain, keeping the subject framing intact.',
        mode: 'i2i',
        notes: 'Upload 1–2 references and set num_images to 2.',
      },
    ],
    faqs: [
      {
        question: 'Can Nano Banana edit existing photos?',
        answer:
          'Yes. Switch to the Edit mode, upload one or more images, then describe the transformation—Nano Banana preserves structure while applying the new look.',
      },
  {
    question: 'How does pricing work for Nano Banana?',
    answer:
      'Each image costs $0.039 from your MaxVideoAI wallet. Running 4 outputs in a batch equals $0.156, so you always know the spend up front.',
  },
],
pricingHint: {
  currency: 'USD',
  amountCents: 4,
  label: 'Per generated image',
},
promptExample:
      'Macro photo of a dew-covered leaf with neon reflections, depth-of-field bokeh, studio lighting',
    category: 'image',
  },
];
