import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  KLING_IMAGE_V4_ASPECT_RATIOS, KLING_IMAGE_V4_ENDPOINTS, KLING_IMAGE_V4_ID,
  KLING_IMAGE_V4_MAX_IMAGE_MB, KLING_IMAGE_V4_MAX_OUTPUTS, KLING_IMAGE_V4_MAX_REFERENCES,
  KLING_IMAGE_V4_MIN_SIDE, KLING_IMAGE_V4_PROMPT_MAX_CHARS, KLING_IMAGE_V4_REFERENCE_ASPECT,
  KLING_IMAGE_V4_REFERENCE_MIME, KLING_IMAGE_V4_RESOLUTIONS,
} from '../../../lib/image/kling-image-v4';

const modes = ['t2i', 'i2i'] as const;
const engineModes = modes.map(mode => ({
  mode,
  falModelId: KLING_IMAGE_V4_ENDPOINTS[mode],
  ui: {
    modes: [mode],
    resolution: [...KLING_IMAGE_V4_RESOLUTIONS],
    aspectRatio: [...KLING_IMAGE_V4_ASPECT_RATIOS],
  },
}));

export const KLING_IMAGE_V4_ENGINE: EngineCaps = {
  id: KLING_IMAGE_V4_ID,
  label: 'Kling Image 4.0',
  provider: 'Kling by Kuaishou',
  version: '4.0',
  status: 'live',
  availability: 'available',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: [...modes],
  maxDurationSec: 0,
  resolutions: [...KLING_IMAGE_V4_RESOLUTIONS],
  aspectRatios: [...KLING_IMAGE_V4_ASPECT_RATIOS],
  fps: [],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: { imageMaxMB: KLING_IMAGE_V4_MAX_IMAGE_MB, promptMaxChars: KLING_IMAGE_V4_PROMPT_MAX_CHARS, promptMaxCharsSource: 'official' },
  inputSchema: {
    required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
    optional: [
      {
        id: 'image_urls', type: 'image', label: 'Reference images', modes: ['i2i'], requiredInModes: ['i2i'],
        source: 'either', minCount: 1, maxCount: KLING_IMAGE_V4_MAX_REFERENCES,
        maxSizeMB: KLING_IMAGE_V4_MAX_IMAGE_MB, imageAspectRatio: KLING_IMAGE_V4_REFERENCE_ASPECT,
        acceptedMimeTypes: KLING_IMAGE_V4_REFERENCE_MIME, acceptedFileExtensions: ['jpg', 'jpeg', 'png', 'webp'],
        description: 'Attach library images in order and refer to them as @Image1, @Image2, and so on.',
      },
      {
        id: 'num_images', type: 'number', label: 'Images',
        min: 1, max: KLING_IMAGE_V4_MAX_OUTPUTS, step: 1, default: 1,
        description: 'Choose one still or 2–10 related images in one ordered Image Set.',
      },
      { id: 'resolution', type: 'enum', label: 'Resolution', values: [...KLING_IMAGE_V4_RESOLUTIONS], default: '2K' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', values: [...KLING_IMAGE_V4_ASPECT_RATIOS], default: 'auto' },
    ],
    constraints: {
      ownedAssetModes: ['i2i'],
      minImageSidePx: KLING_IMAGE_V4_MIN_SIDE,
      maxImageSizeMB: KLING_IMAGE_V4_MAX_IMAGE_MB,
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  updatedAt: '2026-11-20T00:00:00Z',
  ttlSec: 600,
  providerMeta: { provider: 'fal', modelSlug: KLING_IMAGE_V4_ENDPOINTS.t2i },
  brandId: 'kling',
};

export const KLING_IMAGE_V4_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: KLING_IMAGE_V4_ID,
  marketingName: 'Kling Image 4.0',
  cardTitle: 'Kling Image 4.0',
  provider: 'Kling by Kuaishou',
  brandId: 'kling',
  versionLabel: '4.0',
  availability: 'available',
  logoPolicy: 'logoAllowed',
  engine: KLING_IMAGE_V4_ENGINE,
  modes: engineModes,
  defaultFalModelId: KLING_IMAGE_V4_ENDPOINTS.t2i,
  type: 'image',
  prompts: [],
  seo: {
    title: 'Kling Image 4.0 — 8K AI images & Image Sets | MaxVideoAI',
    description: 'Create images at 2K, 4K or 8K. Edit with up to ten references or generate a coordinated Image Set.',
    canonicalPath: '/models/kling-image-v4',
  },
}];
