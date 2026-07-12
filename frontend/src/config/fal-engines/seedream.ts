import type { EngineCaps } from '../../../types/engines';
import {
  SEEDREAM_ASPECT_RATIO_VALUES,
  SEEDREAM_BASE_RESOLUTION_VALUES,
  SEEDREAM_SIZE_VALUES,
} from '../../../lib/image/seedream';
import type { RawFalEngineEntry } from './types';

const SEEDREAM_ENGINE: EngineCaps = {
  id: 'seedream',
  label: 'Seedream',
  provider: 'ByteDance',
  version: '5.0 Lite',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 15,
  resolutions: [...SEEDREAM_SIZE_VALUES],
  aspectRatios: [...SEEDREAM_ASPECT_RATIO_VALUES],
  fps: [1],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the reference image, product still, character, or scene you want Seedream to create.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Images',
        min: 1,
        max: 15,
        step: 1,
        default: 1,
        description:
          'Request up to 15 generated images. Requests above one image use sequential image generation automatically.',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Ratio',
        values: [...SEEDREAM_ASPECT_RATIO_VALUES],
        default: 'auto',
        description:
          'Choose auto, or map the selected Seedream resolution to a recommended width and height.',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Add up to 10 source images for Seedream edit mode. References plus generated images must stay within 15 total images.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 10,
        source: 'either',
      },
      {
        id: 'resolution',
        engineParam: 'size',
        type: 'enum',
        label: 'Image size',
        values: [...SEEDREAM_BASE_RESOLUTION_VALUES],
        default: '2K',
        description: 'Seedream base output resolution. Pair with Ratio for exact recommended dimensions.',
      },
      {
        id: 'output_format',
        engineParam: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: ['jpeg', 'png'],
        default: 'jpeg',
        description: 'Choose the Seedream output file format.',
      },
      {
        id: 'watermark',
        engineParam: 'watermark',
        type: 'boolean',
        label: 'AI watermark',
        default: false,
        description: 'Add AI-generated watermark text to the image.',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'],
      maxImageSizeMB: 10,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 4,
    },
    flatCents: {
      default: 4,
    },
  },
  pricing: {
    unit: 'image',
    base: 0.035,
    currency: 'USD',
    notes:
      'Seedream 5.0 Lite is billed per successfully generated image; MaxVideoAI customer pricing may include platform margin.',
  },
  updatedAt: '2026-05-11T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'byteplus_modelark',
    modelSlug: 'seedream-5-0-260128',
  },
  availability: 'available',
  brandId: 'bytedance',
};

const SEEDREAM_PRO_ENGINE: EngineCaps = {
  id: 'seedream-5-0-pro',
  label: 'Seedream 5.0 Pro',
  provider: 'ByteDance',
  version: '5.0 Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 1,
  resolutions: ['2K', '4K'],
  aspectRatios: [...SEEDREAM_ASPECT_RATIO_VALUES],
  fps: [1],
  audio: false,
  upscale4k: true,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the professional image, infographic, edit, or visual production asset you need.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Images',
        min: 1,
        max: 1,
        step: 1,
        default: 1,
        description: 'Seedream 5.0 Pro supports one generated image per request.',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Ratio',
        values: [...SEEDREAM_ASPECT_RATIO_VALUES],
        default: 'auto',
        description: 'Choose auto, or map the selected Seedream Pro resolution to a recommended width and height.',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Add up to 10 source images for Seedream Pro edit and production-reference workflows.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 10,
        source: 'either',
      },
      {
        id: 'resolution',
        engineParam: 'size',
        type: 'enum',
        label: 'Image size',
        values: ['2K', '4K'],
        default: '2K',
        description: 'Seedream Pro supports 2K and 4K professional outputs.',
      },
      {
        id: 'output_format',
        engineParam: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: ['jpeg', 'png'],
        default: 'jpeg',
        description: 'Choose the Seedream output file format.',
      },
      {
        id: 'watermark',
        engineParam: 'watermark',
        type: 'boolean',
        label: 'AI watermark',
        default: false,
        description: 'Add AI-generated watermark text to the image.',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'],
      maxImageSizeMB: 10,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 12,
      byResolution: {
        '2K': 12,
        '4K': 24,
      },
    },
    flatCents: {
      default: 12,
      byResolution: {
        '2K': 12,
        '4K': 24,
      },
    },
  },
  pricing: {
    unit: 'image',
    base: 0.12,
    byResolution: {
      '2K': 0.12,
      '4K': 0.24,
    },
    currency: 'USD',
    notes: 'Seedream 5.0 Pro is billed per successfully generated professional image.',
  },
  updatedAt: '2026-06-28T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'byteplus_modelark',
    modelSlug: 'seedream-5-0-pro-260628',
  },
  availability: 'available',
  brandId: 'bytedance',
};

export const SEEDREAM_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedream',
    marketingName: 'Seedream',
    cardTitle: 'Seedream 5.0 Lite',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '5.0 Lite',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'Seedream 5.0 Lite is priced per successfully generated image.',
    engine: SEEDREAM_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'byteplus/seedream-5-0-lite',
        ui: {
          modes: ['t2i'],
          resolution: [...SEEDREAM_BASE_RESOLUTION_VALUES],
          aspectRatio: [...SEEDREAM_ASPECT_RATIO_VALUES],
          notes: 'Generate clean concept, product, character, and reference images before video animation.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'byteplus/seedream-5-0-lite',
        ui: {
          modes: ['i2i'],
          resolution: [...SEEDREAM_BASE_RESOLUTION_VALUES],
          aspectRatio: [...SEEDREAM_ASPECT_RATIO_VALUES],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'],
          maxUploadMB: 10,
          notes: 'Edit with up to 10 source images for more controlled visual references.',
        },
      },
    ],
    defaultFalModelId: 'byteplus/seedream-5-0-lite',
    seo: {
      title: 'Seedream 5.0 Lite AI Image Generator for Reference Images | MaxVideoAI',
      description:
        'Use Seedream 5.0 Lite in MaxVideoAI to generate clean AI reference images, product shots, character concepts, ad visuals, and source frames before animating with Seedance 2.0.',
      canonicalPath: '/models/seedream',
    },
    type: 'image',
    seoText:
      'Seedream 5.0 Lite is a ByteDance image model for image generation, visual concept creation, product shots, character references, ad visuals, stylized scenes, and clean reference images for Seedance image-to-video workflows.',
    media: {
      videoUrl: '/assets/models/seedream-hero.webp',
      imagePath: '/assets/models/seedream-hero.webp',
      altText: 'Seedream hero image of a camera lens reflecting a dream landscape',
    },
    prompts: [
      {
        title: 'Seedance reference frame',
        prompt:
          'Create a clean cinematic reference image for a premium skincare bottle on pale stone, controlled daylight, centered hero framing, realistic product label, uncluttered background.',
        mode: 't2i',
        notes: 'Use this as a source frame before animating with Seedance 2.0.',
      },
      {
        title: 'Character reference',
        prompt:
          'Full-body character reference of a modern courier in a yellow rain jacket, neutral stance, consistent face and outfit details, clean studio lighting, simple background.',
        mode: 't2i',
      },
    ],
    faqs: [
      {
        question: 'Is Seedream an image model or a video model?',
        answer:
          'Seedream is exposed as an image generation and editing model in MaxVideoAI. Use Seedance 2.0 or Seedance 2.0 Fast when you want to animate a still image into video.',
      },
      {
        question: 'Does Seedream remove Seedance safety checks?',
        answer:
          'No. Seedream can help create cleaner, more controlled source images, but downstream video requests still follow normal provider review and safety policies.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 4,
      resolution: '2K',
      label: 'Per image',
    },
    promptExample:
      'Clean cinematic reference image of a luxury watch on black stone, precise product shape, readable dial, controlled rim light, uncluttered background for Seedance animation.',
  },
  {
    id: 'seedream-5-0-pro',
    marketingName: 'Seedream 5.0 Pro',
    cardTitle: 'Seedream 5.0 Pro',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '5.0 Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'Seedream 5.0 Pro is priced per professional image output.',
    engine: SEEDREAM_PRO_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'seedream-5-0-pro-260628',
        ui: {
          modes: ['t2i'],
          resolution: ['2K', '4K'],
          aspectRatio: [...SEEDREAM_ASPECT_RATIO_VALUES],
          notes: 'Generate professional infographics, campaign visuals, and high-detail production stills.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'seedream-5-0-pro-260628',
        ui: {
          modes: ['i2i'],
          resolution: ['2K', '4K'],
          aspectRatio: [...SEEDREAM_ASPECT_RATIO_VALUES],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'gif'],
          maxUploadMB: 10,
          notes: 'Edit with up to 10 references for controlled professional visual production.',
        },
      },
    ],
    defaultFalModelId: 'seedream-5-0-pro-260628',
    seo: {
      title: 'Seedream 5.0 Pro AI Image Generator | MaxVideoAI',
      description:
        'Use Seedream 5.0 Pro in MaxVideoAI for professional ByteDance image generation, visual editing, infographics, and 4K campaign-ready stills.',
      canonicalPath: '/models/seedream-5-0-pro',
    },
    type: 'image',
    seoText:
      'Seedream 5.0 Pro is the professional ByteDance image model for dense infographics, advanced visual editing, multilingual layouts, cinematic stills, and polished reference images before animation.',
    media: {
      videoUrl: '/assets/model-examples/seedream-5-0-pro/hero.webp',
      imagePath: '/assets/model-examples/seedream-5-0-pro/hero.webp',
      altText: 'Seedream 5.0 Pro professional image generation example',
    },
    prompts: [
      {
        title: 'High-density infographic',
        prompt:
          'Create a cinematic high-density infographic about a clean-energy city district, layered map view, legible labels, data callouts, glass UI overlays, premium editorial lighting.',
        mode: 't2i',
        notes: 'Use Pro for layouts where reasoning, visual hierarchy, and text clarity matter.',
      },
      {
        title: 'Production edit',
        prompt:
          'Transform these references into one cohesive campaign visual: preserve product shape, merge the architectural backdrop, add dramatic rim light, and keep all typography clean.',
        mode: 'i2i',
      },
    ],
    faqs: [
      {
        question: 'How is Seedream 5.0 Pro different from Seedream 5.0 Lite?',
        answer:
          'Use Seedream 5.0 Pro for professional finals, dense infographics, complex edits, and 4K campaign stills. Use Lite for faster reference-image generation before Seedance.',
      },
      {
        question: 'Does Seedream 5.0 Pro support batch output?',
        answer:
          'No. MaxVideoAI exposes Seedream 5.0 Pro as a single-image professional output route, matching the direct provider API constraints.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 12,
      resolution: '2K',
      label: 'Per 2K image',
    },
    promptExample:
      '4K cinematic poster of a futuristic transport terminal, multilingual wayfinding, accurate small labels, glass reflections, editorial realism.',
  },
];
