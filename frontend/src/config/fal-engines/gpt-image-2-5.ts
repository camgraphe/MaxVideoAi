import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const RESOLUTIONS: EngineCaps['resolutions'] = [
  'landscape_4_3', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9',
  'landscape_16_9', 'custom', 'auto',
];

const TEXT_RESOLUTION_VALUES = [
  'landscape_4_3', 'square_hd', 'square', 'portrait_4_3', 'portrait_16_9',
  'landscape_16_9', '1024x768', '1024x1024', '1024x1536', '1920x1080',
  '2560x1440', '3840x2160', 'custom',
];

const EDIT_RESOLUTION_VALUES = ['auto', ...TEXT_RESOLUTION_VALUES];
const QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max'];

type Variant = 'flare' | 'sunburst';

const MARKETING_IMAGE_BY_VARIANT: Record<Variant, string> = {
  flare: 'https://media.maxvideoai.com/media-assets/301cc489-d689-477f-94c4-0b051deda0bc/6c1fb061-f94e-497f-8f33-7b85d3bceb78.png',
  sunburst: 'https://media.maxvideoai.com/media-assets/301cc489-d689-477f-94c4-0b051deda0bc/61ed3009-b76c-4a5b-acf4-b332563f5e99.png',
};

function buildEngine(variant: Variant): EngineCaps {
  const id = `gpt-image-2-5-${variant}`;
  const variantLabel = variant === 'flare' ? 'Flare' : 'Sunburst';
  return {
    id,
    label: `GPT Image 2.5 ${variantLabel}`,
    provider: 'OpenAI',
    version: '2.5',
    variant: variantLabel,
    status: 'live',
    latencyTier: variant === 'flare' ? 'fast' : 'standard',
    queueDepth: 0,
    region: 'global',
    modes: ['t2i', 'i2i'],
    maxDurationSec: 4,
    resolutions: RESOLUTIONS,
    aspectRatios: ['auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
    fps: [1],
    audio: false,
    upscale4k: true,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { imageMaxMB: 25 },
    inputSchema: {
      required: [{
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the image to generate, or the edit to apply to the references.',
      }],
      optional: [
        {
          id: 'num_images', type: 'number', label: 'Number of images', min: 1, max: 4, step: 1, default: 1,
          description: 'Generate up to 4 images per request.',
        },
        {
          id: 'image_urls', type: 'image', label: 'Reference images', modes: ['i2i'], requiredInModes: ['i2i'],
          minCount: 1, maxCount: 16, source: 'either',
          description: 'Add up to 16 source or reference images for edit mode.',
        },
        {
          id: 'resolution', engineParam: 'image_size', type: 'enum', label: 'Image size', modes: ['t2i'],
          values: TEXT_RESOLUTION_VALUES, default: 'landscape_4_3',
          description: 'Provider image_size preset or canonical custom size.',
        },
        {
          id: 'resolution', engineParam: 'image_size', type: 'enum', label: 'Image size', modes: ['i2i'],
          values: EDIT_RESOLUTION_VALUES, default: 'auto',
          description: 'Use auto to follow an owned source image, or select a preset/custom size.',
        },
        {
          id: 'image_width', engineParam: 'image_size.width', type: 'number', label: 'Custom width',
          modes: ['t2i', 'i2i'], min: 16, max: 3840, step: 16, default: 1024,
        },
        {
          id: 'image_height', engineParam: 'image_size.height', type: 'number', label: 'Custom height',
          modes: ['t2i', 'i2i'], min: 16, max: 3840, step: 16, default: 768,
        },
        {
          id: 'quality', type: 'enum', label: 'Quality', values: QUALITIES, default: 'high',
          description: 'Choose a deterministic quality tier; higher tiers cost more.',
        },
        {
          id: 'background', type: 'enum', label: 'Background', values: ['auto', 'transparent', 'opaque'], default: 'auto',
        },
        {
          id: 'output_format', type: 'enum', label: 'Output format', values: ['png', 'jpeg', 'webp'], default: 'png',
        },
        {
          id: 'mask_url', type: 'image', label: 'Mask image URL', modes: ['i2i'], minCount: 0, maxCount: 1,
          source: 'url', description: 'Optional public mask image URL for edit requests.',
        },
      ],
      constraints: {
        supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        maxImageSizeMB: 25,
        imageSize: { multipleOf: 16, minPixels: 655360, maxPixels: 8294400, maxEdge: 3840, maxAspectRatio: 3 },
      },
    },
    pricingDetails: {
      currency: 'USD',
      perSecondCents: {
        default: 4,
        byResolution: {
          '1024x768': 4, '1024x1024': 6, '1024x1536': 5, '1920x1080': 4,
          '2560x1440': 6, '3840x2160': 11, landscape_4_3: 4, portrait_4_3: 4,
          square: 6, square_hd: 6, portrait_16_9: 5, landscape_16_9: 4, custom: 4, auto: 6,
        },
      },
    },
    pricing: {
      unit: 'image', base: 0.03612,
      byResolution: {
        '1024x768': 0.03612, '1024x1024': 0.05268, '1024x1536': 0.04116,
        '1920x1080': 0.0396, '2560x1440': 0.05529, '3840x2160': 0.10008,
        landscape_4_3: 0.03612, portrait_4_3: 0.03612, square: 0.05268,
        square_hd: 0.05268, portrait_16_9: 0.04116, landscape_16_9: 0.0396,
        custom: 0.03612, auto: 0.05268,
      },
      currency: 'USD',
      notes: 'fal.ai provider pricing varies by deterministic quality and image_size.',
    },
    updatedAt: '2026-09-15T00:00:00Z',
    ttlSec: 600,
    providerMeta: { provider: 'fal.ai', modelSlug: `openai/gpt-image-2.5/${variant}` },
    availability: 'available',
    brandId: 'openai',
  };
}

function buildEntry(variant: Variant): RawFalEngineEntry {
  const variantLabel = variant === 'flare' ? 'Flare' : 'Sunburst';
  const id = `gpt-image-2-5-${variant}`;
  const engine = buildEngine(variant);
  const root = `openai/gpt-image-2.5/${variant}`;
  const positioning = variant === 'flare'
    ? 'fast, high-quality everyday image generation and editing'
    : 'precision image generation and detail-focused editing';
  return {
    id,
    marketingName: `GPT Image 2.5 ${variantLabel}`,
    cardTitle: `GPT Image 2.5 ${variantLabel}`,
    provider: 'OpenAI',
    brandId: 'openai',
    versionLabel: `2.5 ${variantLabel}`,
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'Provider pricing varies by deterministic quality, image size, and edit references.',
    engine,
    modes: [
      {
        mode: 't2i', falModelId: `${root}/text-to-image`,
        ui: { modes: ['t2i'], resolution: TEXT_RESOLUTION_VALUES, notes: positioning },
      },
      {
        mode: 'i2i', falModelId: `${root}/edit`,
        ui: {
          modes: ['i2i'], resolution: EDIT_RESOLUTION_VALUES,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'], maxUploadMB: 25,
          notes: `Edit with up to 16 references using ${variantLabel}.`,
        },
      },
    ],
    defaultFalModelId: `${root}/text-to-image`,
    seo: {
      title: `GPT Image 2.5 ${variantLabel} – AI Image Generation & Editing | MaxVideoAI`,
      description: `Generate and edit images with GPT Image 2.5 ${variantLabel} through fal.ai in MaxVideoAI.`,
      canonicalPath: `/models/gpt-image-2-5-${variant}`,
    },
    type: 'image',
    seoText: `GPT Image 2.5 ${variantLabel} provides ${positioning} in the MaxVideoAI Image workspace.`,
    media: {
      videoUrl: MARKETING_IMAGE_BY_VARIANT[variant],
      imagePath: MARKETING_IMAGE_BY_VARIANT[variant],
      altText: variant === 'flare'
        ? 'GPT Image 2.5 Flare render of a monumental after-dark arts festival poster'
        : 'GPT Image 2.5 Sunburst render of a text-rich illustrated city atlas',
    },
    prompts: [
      { title: 'Product campaign', prompt: 'Premium product campaign still, exact readable label, controlled studio light, polished catalog composition.', mode: 't2i' },
      { title: 'Controlled edit', prompt: 'Preserve the subject and typography, replace the environment, and keep materials and lighting coherent.', mode: 'i2i' },
    ],
    faqs: [
      { question: `What is GPT Image 2.5 ${variantLabel} best for?`, answer: `Use ${variantLabel} for ${positioning}.` },
      { question: 'Does it support image editing?', answer: 'Yes. The edit route accepts up to 16 source or reference images and an optional mask.' },
    ],
    pricingHint: { currency: 'USD', amountCents: 4, resolution: '1024x768', label: 'High quality 1024x768 provider cost' },
    promptExample: 'Editorial product still with exact headline text, realistic materials, controlled lighting, and a clean campaign layout.',
  };
}

export const GPT_IMAGE_2_5_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  buildEntry('flare'),
  buildEntry('sunburst'),
];
