import type { EngineCaps } from '../../../types/engines';
import {
  BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO,
  BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES,
  BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES,
  BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS,
  BYTEPLUS_SEEDANCE_2_5_MODES,
} from '../../server/video-providers/byteplus-modelark-constants';
import type { RawFalEngineEntry } from './types';
import {
  BYTEPLUS_SEEDANCE_2_5_ENDPOINTS,
  BYTEPLUS_SEEDANCE_2_5_MODEL_ID,
  buildSeedance25PricingDetails,
} from './launch-config';

const DURATION_OPTIONS = Array.from({ length: 27 }, (_, index) => index + 4);
const RESOLUTIONS: EngineCaps['resolutions'] = ['480p', '720p'];
const ASPECT_RATIOS: EngineCaps['aspectRatios'] = ['16:9'];
const IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];
const VIDEO_FORMATS = ['mp4', 'mov'];
const AUDIO_FORMATS = ['mp3', 'wav'];
type Seedance25Mode = keyof typeof BYTEPLUS_SEEDANCE_2_5_ENDPOINTS;
const SEEDANCE_2_5_MODES = BYTEPLUS_SEEDANCE_2_5_MODES as Seedance25Mode[];

const SEEDANCE_2_5_ENGINE: EngineCaps = {
  id: 'seedance-2-5',
  label: 'Seedance 2.5',
  provider: 'ByteDance',
  version: '2.5',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'ap-southeast-1',
  modes: [...SEEDANCE_2_5_MODES],
  maxDurationSec: 30,
  resolutions: [...RESOLUTIONS],
  aspectRatios: [...ASPECT_RATIOS],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 30,
    videoMaxMB: 50,
    audioMaxMB: 15,
    videoMaxDurationSec: 30,
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
        description: 'Required starting frame for image-to-video.',
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
        description: 'Optional final frame for image-to-video transitions.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: DURATION_OPTIONS.map(String),
        default: '4',
        min: 4,
        max: 30,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...ASPECT_RATIOS],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: [...RESOLUTIONS],
        default: '480p',
      },
      {
        id: 'generate_audio',
        type: 'boolean',
        label: 'Audio',
        default: true,
      },
      {
        id: 'image_urls',
        type: 'image',
        label: `Reference images (up to ${BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES})`,
        description: 'Optional visual references for reference-to-video or video-to-video.',
        modes: ['ref2v', 'v2v'],
        minCount: 1,
        maxCount: BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES,
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
        label: `Reference video clips (up to ${BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS})`,
        description: 'Optional motion or pacing references for reference-to-video.',
        modes: ['ref2v'],
        minCount: 0,
        maxCount: BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS,
        source: 'either',
      },
      {
        id: 'extension_source_videos',
        type: 'video',
        label: 'Source clips to extend (up to 3)',
        description: 'Extend one source clip or stitch a transition from two or three clips.',
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
        label: `Reference audio clips (up to ${BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO})`,
        description: 'Optional audio references for reference-to-video or video-to-video.',
        modes: ['ref2v', 'v2v'],
        minCount: 0,
        maxCount: BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO,
        source: 'either',
      },
    ],
    referenceBudget: {
      fieldIds: [
        'image_url',
        'end_image_url',
        'image_urls',
        'video_url',
        'video_urls',
        'extension_source_videos',
        'audio_urls',
      ],
      maxTotal: BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES,
      countUniqueUrls: true,
      modes: ['i2v', 'ref2v', 'v2v', 'extend'],
    },
    constraints: {
      supportedFormats: [...IMAGE_FORMATS, ...VIDEO_FORMATS, ...AUDIO_FORMATS],
      maxImageSizeMB: 30,
      minImageSidePx: 300,
      maxVideoSizeMB: 50,
      maxAudioSizeMB: 15,
    },
  },
  pricingDetails: buildSeedance25PricingDetails(),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes:
      'Price is calculated before generation based on duration, resolution, and whether a source video is used.',
  },
  updatedAt: '2026-08-07T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'byteplus_modelark',
    modelSlug: BYTEPLUS_SEEDANCE_2_5_MODEL_ID,
  },
  availability: 'limited',
  brandId: 'bytedance',
};

function seedance25Mode(mode: Seedance25Mode): RawFalEngineEntry['modes'][number] {
  const acceptsImages = mode === 'i2v' || mode === 'ref2v' || mode === 'v2v';
  const uploadsVideo = mode === 'ref2v' || mode === 'v2v' || mode === 'extend';
  const uploadsAudio = mode === 'ref2v' || mode === 'v2v';
  const acceptedFormats = [
    acceptsImages ? `images: ${IMAGE_FORMATS.join(', ')}` : null,
    uploadsVideo ? `video: ${VIDEO_FORMATS.join(', ')}` : null,
    uploadsAudio ? `audio: ${AUDIO_FORMATS.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ');
  const workflowNotes: Record<Seedance25Mode, string> = {
    t2v: 'Create 4-30 second 480p or 720p 16:9 videos with generated audio available.',
    i2v: 'Animate one start image with an optional end image; 4-30 seconds, 480p/720p, 16:9, and generated audio.',
    ref2v: `Use up to ${BYTEPLUS_SEEDANCE_2_5_MAX_IMAGES} images, ${BYTEPLUS_SEEDANCE_2_5_MAX_VIDEOS} video clips, and ${BYTEPLUS_SEEDANCE_2_5_MAX_AUDIO} audio clips, with ${BYTEPLUS_SEEDANCE_2_5_MAX_REFERENCES} unique references total.`,
    v2v: 'Edit one source video with optional image and audio references; 4-30 seconds, 480p/720p, 16:9, and generated audio.',
    extend: 'Continue one to three source clips; 4-30 seconds, 480p/720p, 16:9, and generated audio.',
  };

  return {
    mode,
    falModelId: BYTEPLUS_SEEDANCE_2_5_ENDPOINTS[mode],
    ui: {
      modes: [mode],
      duration: { options: [...DURATION_OPTIONS], default: 4 },
      resolution: [...RESOLUTIONS],
      aspectRatio: [...ASPECT_RATIOS],
      acceptsImageFormats: acceptsImages ? [...IMAGE_FORMATS] : undefined,
      maxUploadMB: mode === 't2v' ? undefined : uploadsVideo ? 50 : 30,
      audioToggle: true,
      notes: [workflowNotes[mode], acceptedFormats].filter(Boolean).join(' '),
    },
  };
}

export const SEEDANCE_2_5_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-2-5',
    marketingName: 'Seedance 2.5',
    cardTitle: 'Seedance 2.5',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '2.5',
    availability: 'limited',
    logoPolicy: 'textOnly',
    billingNote:
      'Your final price is calculated before generation from the selected duration, resolution, and inputs.',
    engine: SEEDANCE_2_5_ENGINE,
    modes: SEEDANCE_2_5_MODES.map(seedance25Mode),
    defaultFalModelId: BYTEPLUS_SEEDANCE_2_5_ENDPOINTS.t2v,
    seo: {
      title: 'Seedance 2.5 — MaxVideoAI',
      description: 'Seedance 2.5 video generation workflows on MaxVideoAI.',
      canonicalPath: '/models/seedance-2-5',
    },
    type: 'textImage',
    prompts: [],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Price calculated before generation',
    },
    promptExample: 'A short cinematic scene with clear movement and no text overlays.',
  },
];
