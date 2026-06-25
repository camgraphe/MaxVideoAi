import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  BYTEPLUS_SEEDANCE_2_MINI_ENDPOINTS,
  BYTEPLUS_SEEDANCE_2_MINI_MODEL_ID,
  buildSeedance2MiniPricingDetails,
  buildSeedance2MiniSurfaces,
} from './launch-config';

const MINI_DURATION_OPTIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
const MINI_RESOLUTIONS = ['480p', '720p'] as const;
const SEEDANCE_2_MINI_ASPECT_RATIOS = ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
const SEEDANCE_2_MINI_PUBLIC_SLUG = 'dreamina-seedance-2-0-mini';

const SEEDANCE_2_0_MINI_ENGINE: EngineCaps = {
  id: 'seedance-2-0-mini',
  label: 'Dreamina Seedance 2.0 Mini',
  provider: 'ByteDance',
  version: '2.0',
  variant: 'Mini',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
  maxDurationSec: 15,
  resolutions: [...MINI_RESOLUTIONS],
  aspectRatios: [...SEEDANCE_2_MINI_ASPECT_RATIOS],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: true,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 30,
    videoMaxMB: 50,
    audioMaxMB: 15,
    videoMaxDurationSec: 15,
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
        label: 'Start image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional last frame for start-to-end transitions in image-to-video.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: MINI_DURATION_OPTIONS.map(String),
        default: '5',
        min: 4,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...SEEDANCE_2_MINI_ASPECT_RATIOS],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: [...MINI_RESOLUTIONS],
        default: '720p',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images (up to 9)',
        description: 'Optional visual references for Reference to Video or Video Edit.',
        modes: ['ref2v', 'v2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Required source video for video-to-video editing.',
        modes: ['v2v'],
        requiredInModes: ['v2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_urls',
        type: 'video',
        label: 'Reference video clips (up to 3)',
        description: 'Optional video references for Reference to Video.',
        modes: ['ref2v'],
        minCount: 0,
        maxCount: 3,
        source: 'either',
      },
      {
        id: 'extension_source_videos',
        type: 'video',
        label: 'Source clips to extend (up to 3)',
        description: 'Add one source clip to extend forward or backward, or 2-3 clips to stitch a transition.',
        modes: ['extend'],
        requiredInModes: ['extend'],
        minCount: 1,
        maxCount: 3,
        source: 'either',
        slotLabelPattern: 'Source clip {n}',
      },
      {
        id: 'audio_urls',
        type: 'audio',
        label: 'Reference audio clips (up to 3)',
        description: 'Optional audio references for pacing or soundtrack guidance.',
        modes: ['ref2v', 'v2v'],
        minCount: 0,
        maxCount: 3,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mp3', 'wav'],
      maxImageSizeMB: 30,
      maxVideoSizeMB: 50,
      maxAudioSizeMB: 15,
    },
  },
  pricingDetails: buildSeedance2MiniPricingDetails(),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes: 'Seedance 2 Mini is billed from output tokens with one flat public MaxVideoAI rate across text, image, reference, source-video, and extend workflows.',
  },
  updatedAt: '2026-06-15T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'byteplus_modelark',
    modelSlug: BYTEPLUS_SEEDANCE_2_MINI_MODEL_ID,
  },
  availability: 'available',
  brandId: 'bytedance',
};

function miniMode(mode: 't2v' | 'i2v' | 'ref2v' | 'v2v' | 'extend'): RawFalEngineEntry['modes'][number] {
  return {
    mode,
    falModelId: BYTEPLUS_SEEDANCE_2_MINI_ENDPOINTS[mode],
    ui: {
      modes: [mode],
      duration: { options: [...MINI_DURATION_OPTIONS], default: 5 },
      resolution: [...MINI_RESOLUTIONS],
      aspectRatio: [...SEEDANCE_2_MINI_ASPECT_RATIOS],
      acceptsImageFormats: mode === 't2v' || mode === 'extend' ? undefined : ['jpg', 'jpeg', 'png', 'webp'],
      maxUploadMB: mode === 't2v' ? undefined : mode === 'i2v' ? 30 : 50,
      audioToggle: false,
      notes:
        mode === 'extend'
          ? 'Dreamina Seedance Mini extends 1-3 source clips at 4-15s, 480p/720p, 24fps.'
          : 'Dreamina Seedance Mini supports 4-15s, 480p/720p, 24fps, and reference audio as input only.',
    },
  };
}

export const SEEDANCE_2_MINI_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-2-0-mini',
    modelSlug: SEEDANCE_2_MINI_PUBLIC_SLUG,
    marketingName: 'Dreamina Seedance 2.0 Mini',
    cardTitle: 'Dreamina Seedance 2.0 Mini',
    provider: 'ByteDance',
    brandId: 'bytedance',
    family: 'seedance',
    versionLabel: '2.0 Mini',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'Seedance 2 Mini uses token pricing with separate no-video-input and video-input rates.',
    engine: SEEDANCE_2_0_MINI_ENGINE,
    modes: [miniMode('t2v'), miniMode('i2v'), miniMode('ref2v'), miniMode('v2v'), miniMode('extend')],
    defaultFalModelId: BYTEPLUS_SEEDANCE_2_MINI_ENDPOINTS.t2v,
    seo: {
      title: 'Seedance 2.0 Mini — Dreamina AI Video Model',
      description:
        'Seedance 2.0 Mini is a Dreamina AI video model for text, image, reference, video edit, and extension workflows at 480p/720p.',
      canonicalPath: `/models/${SEEDANCE_2_MINI_PUBLIC_SLUG}`,
    },
    type: 'textImage',
    seoText:
      'Seedance 2.0 Mini supports text, image, reference, video edit, and extension workflows with 4-15 second 480p/720p output at 24fps.',
    prompts: [
      {
        title: 'Compact concept pass',
        prompt: 'Create a short cinematic product moment with realistic motion and clean framing.',
        mode: 't2v',
      },
    ],
    faqs: [],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Live quote in Generate',
    },
    surfaces: buildSeedance2MiniSurfaces(),
    promptExample: 'Short Seedance 2.0 Mini video pass, 720p, 16:9, 5 seconds.',
  },
];
