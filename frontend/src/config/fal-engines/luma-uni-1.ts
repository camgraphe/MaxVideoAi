import type { EngineCaps } from '../../../types/engines';
import {
  LUMA_AGENTS_PROVIDER,
  LUMA_UNI_FAL_MODEL_BY_ENGINE_MODE,
  LUMA_UNI_MODEL_BY_ENGINE,
} from '../../lib/luma-agents';
import {
  LUMA_SUPPORTED_IMAGE_FORMATS,
  LUMA_UNI_ASPECT_RATIOS,
  LUMA_UNI_IMAGE_MAX_MB,
  LUMA_UNI_OUTPUT_FORMATS,
  LUMA_UNI_REFERENCE_IMAGE_LIMIT_EDIT_TOTAL,
  LUMA_UNI_REFERENCE_IMAGE_LIMIT_T2I,
  LUMA_UNI_STYLES,
} from './luma-agents-shared';
import type { RawFalEngineEntry } from './types';

const LUMA_UNI_1_ENGINE: EngineCaps = {
  id: 'luma-uni-1',
  label: 'Luma Uni-1',
  provider: 'Luma AI',
  version: 'Uni-1',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 1,
  resolutions: ['2K'],
  aspectRatios: [...LUMA_UNI_ASPECT_RATIOS] as EngineCaps['aspectRatios'],
  fps: [1],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: LUMA_UNI_IMAGE_MAX_MB,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the image to generate or the edit to apply.',
      },
    ],
    optional: [
      {
        id: 'image_urls',
        type: 'image',
        label: 'Source and reference images',
        description:
          'For text-to-image, add up to 9 reference images. For image edit, the first image is the source and the remaining slots are references.',
        modes: ['t2i', 'i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: LUMA_UNI_REFERENCE_IMAGE_LIMIT_EDIT_TOTAL,
        source: 'either',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...LUMA_UNI_ASPECT_RATIOS],
        default: '16:9',
        modes: ['t2i'],
      },
      {
        id: 'style',
        type: 'enum',
        label: 'Style',
        values: [...LUMA_UNI_STYLES],
        default: 'auto',
        modes: ['t2i', 'i2i'],
      },
      {
        id: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: [...LUMA_UNI_OUTPUT_FORMATS],
        default: 'png',
        modes: ['t2i', 'i2i'],
      },
      {
        id: 'enable_web_search',
        type: 'boolean',
        label: 'Web search',
        default: false,
        modes: ['t2i'],
        description: 'Allow the provider to use web search for text-to-image requests.',
      },
      {
        id: 'num_images',
        type: 'number',
        label: 'Images',
        min: 1,
        max: 1,
        step: 1,
        default: 1,
        description: 'Luma Uni returns one image per public workspace request.',
      },
    ],
    constraints: {
      supportedFormats: [...LUMA_SUPPORTED_IMAGE_FORMATS],
      maxImageSizeMB: LUMA_UNI_IMAGE_MAX_MB,
      maxReferenceImagesTextToImage: LUMA_UNI_REFERENCE_IMAGE_LIMIT_T2I,
      maxReferenceImagesEdit: LUMA_UNI_REFERENCE_IMAGE_LIMIT_EDIT_TOTAL - 1,
    },
  },
  updatedAt: '2026-06-09T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: LUMA_AGENTS_PROVIDER,
    modelSlug: LUMA_UNI_MODEL_BY_ENGINE['luma-uni-1'],
  },
  availability: 'available',
  brandId: 'luma',
};

export const LUMA_UNI_1_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'luma-uni-1',
    marketingName: 'Luma Uni-1',
    cardTitle: 'Luma Uni-1',
    provider: 'Luma AI',
    brandId: 'luma',
    versionLabel: 'Uni-1',
    availability: 'available',
    logoPolicy: 'logoAllowed',
    engine: LUMA_UNI_1_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: LUMA_UNI_FAL_MODEL_BY_ENGINE_MODE['luma-uni-1'].t2i,
        ui: {
          modes: ['t2i'],
          resolution: ['2K'],
          resolutionLocked: true,
          aspectRatio: [...LUMA_UNI_ASPECT_RATIOS],
          acceptsImageFormats: [...LUMA_SUPPORTED_IMAGE_FORMATS],
          maxUploadMB: LUMA_UNI_IMAGE_MAX_MB,
        },
      },
      {
        mode: 'i2i',
        falModelId: LUMA_UNI_FAL_MODEL_BY_ENGINE_MODE['luma-uni-1'].i2i,
        ui: {
          modes: ['i2i'],
          resolution: ['2K'],
          resolutionLocked: true,
          acceptsImageFormats: [...LUMA_SUPPORTED_IMAGE_FORMATS],
          maxUploadMB: LUMA_UNI_IMAGE_MAX_MB,
          notes: 'Use the first image as the edit source, followed by optional references.',
        },
      },
    ],
    defaultFalModelId: LUMA_UNI_FAL_MODEL_BY_ENGINE_MODE['luma-uni-1'].t2i,
    seo: {
      title: 'Luma Uni-1 AI Image Generator | MaxVideoAI',
      description:
        'Use Luma Uni-1 in MaxVideoAI for text-to-image and image editing with references, manga style, output format controls, and 2K image output.',
      canonicalPath: '/models/luma-uni-1',
    },
    type: 'Image generation and editing',
    seoText:
      'Luma Uni-1 is available in MaxVideoAI as a public image generation and image editing engine with source and reference image controls.',
    prompts: [
      {
        title: 'Reference-led product image',
        prompt:
          'Create a polished product image on a clean studio background, preserve the supplied product shape, soft daylight, premium catalog finish.',
        mode: 't2i',
      },
    ],
    promptExample:
      'Create a cinematic reference image of a minimalist perfume bottle on polished stone, precise label detail, soft rim light, 16:9.',
  },
];
