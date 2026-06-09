import type { EngineCaps } from '../../../types/engines';
import { LUMA_AGENTS_PROVIDER, LUMA_RAY_32_FAL_MODEL_BY_MODE } from '../../lib/luma-agents';
import {
  LUMA_RAY_32_ASPECT_RATIOS,
  LUMA_RAY_32_DURATIONS,
  LUMA_RAY_32_IMAGE_MAX_MB,
  LUMA_RAY_32_REFERENCE_IMAGE_UI_LIMIT,
  LUMA_RAY_32_RESOLUTIONS,
  LUMA_RAY_32_VIDEO_MAX_DURATION_SEC,
  LUMA_RAY_32_VIDEO_MAX_MB,
  LUMA_SUPPORTED_IMAGE_FORMATS,
  LUMA_SUPPORTED_VIDEO_FORMATS,
} from './luma-agents-shared';
import type { RawFalEngineEntry } from './types';

const LUMA_RAY_3_2_ENGINE: EngineCaps = {
  id: 'luma-ray-3-2',
  label: 'Luma Ray 3.2',
  provider: 'Luma AI',
  version: 'Ray 3.2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: [...LUMA_RAY_32_RESOLUTIONS],
  aspectRatios: [...LUMA_RAY_32_ASPECT_RATIOS] as EngineCaps['aspectRatios'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: LUMA_RAY_32_IMAGE_MAX_MB,
    videoMaxMB: LUMA_RAY_32_VIDEO_MAX_MB,
    videoMaxDurationSec: LUMA_RAY_32_VIDEO_MAX_DURATION_SEC,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'i2v'],
        requiredInModes: ['t2v', 'i2v'],
        description: 'Describe the video motion, subject, camera, and style.',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one source image to anchor the opening frame for image-to-video.',
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
        values: [...LUMA_RAY_32_DURATIONS],
        default: '5s',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...LUMA_RAY_32_ASPECT_RATIOS],
        default: '16:9',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: [...LUMA_RAY_32_RESOLUTIONS],
        default: '540p',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'loop',
        type: 'boolean',
        label: 'Loop video',
        default: false,
        modes: ['t2v', 'i2v'],
        description: 'Loop is supported for 5s requests. 10s loop requests are provider-limited.',
      },
      {
        id: 'reference_image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Optional images to guide composition, subject, or style without replacing the start image.',
        modes: ['t2v', 'i2v'],
        minCount: 0,
        maxCount: LUMA_RAY_32_REFERENCE_IMAGE_UI_LIMIT,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: [...LUMA_SUPPORTED_IMAGE_FORMATS, ...LUMA_SUPPORTED_VIDEO_FORMATS],
      maxImageSizeMB: LUMA_RAY_32_IMAGE_MAX_MB,
      maxVideoSizeMB: LUMA_RAY_32_VIDEO_MAX_MB,
      maxVideoDurationSec: LUMA_RAY_32_VIDEO_MAX_DURATION_SEC,
    },
  },
  updatedAt: '2026-06-09T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: LUMA_AGENTS_PROVIDER,
    modelSlug: 'ray-3-2',
  },
  availability: 'available',
  brandId: 'luma',
};

export const LUMA_RAY_3_2_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'luma-ray-3-2',
    modelSlug: 'luma-ray-3-2',
    marketingName: 'Luma Ray 3.2',
    cardTitle: 'Luma Ray 3.2',
    provider: 'Luma AI',
    brandId: 'luma',
    family: 'luma-ray',
    versionLabel: 'Ray 3.2',
    availability: 'available',
    logoPolicy: 'logoAllowed',
    engine: LUMA_RAY_3_2_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: LUMA_RAY_32_FAL_MODEL_BY_MODE.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: [...LUMA_RAY_32_DURATIONS], default: '5s' },
          resolution: [...LUMA_RAY_32_RESOLUTIONS],
          aspectRatio: [...LUMA_RAY_32_ASPECT_RATIOS],
          acceptsImageFormats: [...LUMA_SUPPORTED_IMAGE_FORMATS],
          maxUploadMB: LUMA_RAY_32_IMAGE_MAX_MB,
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: LUMA_RAY_32_FAL_MODEL_BY_MODE.i2v,
        ui: {
          modes: ['i2v'],
          duration: { options: [...LUMA_RAY_32_DURATIONS], default: '5s' },
          resolution: [...LUMA_RAY_32_RESOLUTIONS],
          aspectRatio: [...LUMA_RAY_32_ASPECT_RATIOS],
          acceptsImageFormats: [...LUMA_SUPPORTED_IMAGE_FORMATS],
          maxUploadMB: LUMA_RAY_32_IMAGE_MAX_MB,
          audioToggle: false,
          notes: 'Animate one source image, with optional reference images for style or subject guidance.',
        },
      },
    ],
    defaultFalModelId: LUMA_RAY_32_FAL_MODEL_BY_MODE.t2v,
    seo: {
      title: 'Luma Ray 3.2 AI Video Generator | MaxVideoAI',
      description:
        'Use Luma Ray 3.2 in MaxVideoAI for public text-to-video and image-to-video generation with 5s or 10s clips, 540p to 1080p output, and extended aspect ratios.',
      canonicalPath: '/models/luma-ray-3-2',
    },
    type: 'Text and image to video',
    seoText:
      'Luma Ray 3.2 is available in MaxVideoAI as a public video generation engine for text-to-video and image-to-video workflows through fallback-safe fal endpoints.',
    demoUrl: '/hero/luma-dream.mp4',
    media: {
      videoUrl: '/hero/luma-dream.mp4',
      imagePath: '/hero/luma-dream.jpg',
      altText: 'Cinematic AI video frame for Luma Ray 3.2',
    },
    prompts: [
      {
        title: 'Cinematic product reveal',
        prompt:
          'Slow cinematic push-in on a premium product box on dark stone, controlled reflections, realistic motion, shallow depth of field.',
        mode: 't2v',
      },
    ],
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: false,
        includeInFamilyCopy: false,
      },
      compare: {
        suggestOpponents: ['veo-3-1-fast', 'kling-3-standard', 'luma-ray-2'],
        publishedPairs: [],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 12,
        variantGroup: 'luma-ray',
        variantLabel: 'Ray 3.2',
      },
      pricing: {
        includeInEstimator: true,
      },
    },
    promptExample:
      'Handheld cinematic shot of a designer chair in a sunlit studio, subtle parallax, soft fabric movement, 5s, 16:9.',
    category: 'video',
  },
];
