import { withSeedanceModelArkOptions, SEEDANCE_MODELARK_IMAGE_FORMATS } from '../../../lib/seedance-modelark-options';
import type { EngineCaps } from '../../../types/engines';
import { getBytePlusSeedanceModeResolutions } from '../../../lib/byteplus-mode-capabilities';
import {
  BYTEPLUS_SEEDANCE_2_5_MODES,
} from '../../server/video-providers/byteplus-modelark-constants';
import type { RawFalEngineEntry } from './types';
import {
  BYTEPLUS_SEEDANCE_2_5_FLASH_ENDPOINTS,
  BYTEPLUS_SEEDANCE_2_5_FLASH_MODEL_ID,
  buildSeedance25FlashPricingDetails,
} from './launch-config';

const FLASH_MAX_IMAGES = 10;
const FLASH_MAX_VIDEOS = 5;
const FLASH_MAX_AUDIO = 5;
const FLASH_MAX_REFERENCES = 20;

const DURATION_OPTIONS = Array.from({ length: 27 }, (_, index) => index + 4);
const RESOLUTIONS: EngineCaps['resolutions'] = ['480p', '720p'];
const ASPECT_RATIOS: EngineCaps['aspectRatios'] = ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'];
const IMAGE_FORMATS = SEEDANCE_MODELARK_IMAGE_FORMATS;
const VIDEO_FORMATS = ['mp4', 'mov'];
const AUDIO_FORMATS = ['mp3', 'wav'];
type Seedance25Mode = keyof typeof BYTEPLUS_SEEDANCE_2_5_FLASH_ENDPOINTS;
const SEEDANCE_2_5_MODES = BYTEPLUS_SEEDANCE_2_5_MODES as Seedance25Mode[];

const SEEDANCE_2_5_ENGINE: EngineCaps = withSeedanceModelArkOptions({
  id: 'seedance-2-5-flash',
  label: 'Seedance 2.5 Flash',
  provider: 'ByteDance',
  version: '2.5 Flash',
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
    videoMaxMB: 200,
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
        modes: ['t2v', 'ref2v', 'v2v', 'extend'],
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
        label: `Reference images (up to ${FLASH_MAX_IMAGES})`,
        description: 'Optional visual references for reference-to-video or video-to-video.',
        modes: ['ref2v', 'v2v'],
        minCount: 1,
        maxCount: FLASH_MAX_IMAGES,
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
        label: `Reference video clips (up to ${FLASH_MAX_VIDEOS})`,
        description: 'Optional motion or pacing references. Keep all reference videos within 30 seconds in total.',
        modes: ['ref2v'],
        minCount: 0,
        maxCount: FLASH_MAX_VIDEOS,
        source: 'either',
      },
      {
        id: 'extension_source_videos',
        type: 'video',
        label: `Source clips to extend (up to ${FLASH_MAX_VIDEOS})`,
        description: 'Extend a source clip or connect source clips, within 30 seconds in total.',
        modes: ['extend'],
        requiredInModes: ['extend'],
        minCount: 1,
        maxCount: FLASH_MAX_VIDEOS,
        source: 'either',
        slotLabelPattern: 'Source clip {n}',
      },
      {
        id: 'audio_urls',
        type: 'audio',
        label: `Reference audio clips (up to ${FLASH_MAX_AUDIO})`,
        description: 'Optional audio references for reference-to-video or video-to-video.',
        modes: ['ref2v', 'v2v'],
        minCount: 0,
        maxCount: FLASH_MAX_AUDIO,
        maxSizeMB: 15,
        acceptedMimeTypes: [
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/x-wav',
          'audio/wave',
          'audio/vnd.wave',
        ],
        acceptedFileExtensions: [...AUDIO_FORMATS],
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
      maxTotal: FLASH_MAX_REFERENCES,
      countUniqueUrls: true,
      modes: ['i2v', 'ref2v', 'v2v', 'extend'],
    },
    constraints: {
      ownedAssetModes: ['v2v'],
      supportedFormats: [...IMAGE_FORMATS, ...VIDEO_FORMATS, ...AUDIO_FORMATS],
      maxImageSizeMB: 30,
      minImageSidePx: 300,
      maxVideoSizeMB: 200,
      // ModelArk accepts up to 30.2 s including container/frame timing tolerance.
      maxCombinedVideoDurationSec: 30.2,
      combinedDurationModes: ['ref2v', 'v2v', 'extend'],
      minVideoPixelCount: 407696,
      maxAudioSizeMB: 15,
    },
  },
  pricingDetails: buildSeedance25FlashPricingDetails(),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes:
      'Price is calculated before generation based on duration, resolution, and whether a source video is used.',
  },
  updatedAt: '2026-11-13T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'byteplus_modelark',
    modelSlug: BYTEPLUS_SEEDANCE_2_5_FLASH_MODEL_ID,
  },
  availability: 'available',
  brandId: 'bytedance',
});

function seedance25Mode(mode: Seedance25Mode): RawFalEngineEntry['modes'][number] {
  const acceptsImages = mode !== 't2v';
  const uploadsVideo = mode === 'ref2v' || mode === 'v2v' || mode === 'extend';
  const uploadsAudio = mode === 'ref2v' || mode === 'v2v' || mode === 'extend';
  const acceptedFormats = [
    acceptsImages ? `images: ${IMAGE_FORMATS.join(', ')}` : null,
    uploadsVideo ? `video: ${VIDEO_FORMATS.join(', ')}` : null,
    uploadsAudio ? `audio: ${AUDIO_FORMATS.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ');
  const workflowNotes: Record<Seedance25Mode, string> = {
    t2v: 'Create 4-30 second videos up to 720p in landscape, square, or vertical formats with generated audio available.',
    i2v: 'Animate one start image with an optional end image; 4-30 seconds, up to 720p, landscape, square, or vertical, with generated audio.',
    ref2v: `Use up to ${FLASH_MAX_IMAGES} images, ${FLASH_MAX_VIDEOS} video clips, and ${FLASH_MAX_AUDIO} audio clips, with ${FLASH_MAX_REFERENCES} unique references total.`,
    v2v: 'Edit one source video with optional image, video and audio references; 4-30 seconds, up to 720p, landscape, square, or vertical, with generated audio.',
    extend: 'Continue one to five source clips with optional image and audio references; 4-30 seconds, up to 720p, landscape, square, or vertical, with generated audio.',
  };

  return {
    mode,
    falModelId: BYTEPLUS_SEEDANCE_2_5_FLASH_ENDPOINTS[mode],
    ui: {
      modes: [mode],
      duration: { options: [...(mode === 'v2v' ? [] : ['auto']), ...DURATION_OPTIONS], default: 4 },
      resolution: getBytePlusSeedanceModeResolutions('seedance-2-5-flash', mode, RESOLUTIONS, 'modelark'),
      aspectRatio: mode === 'i2v' ? undefined : [...ASPECT_RATIOS],
      acceptsImageFormats: acceptsImages ? [...IMAGE_FORMATS] : undefined,
      maxUploadMB: mode === 't2v' ? undefined : uploadsVideo ? 200 : 30,
      audioToggle: true,
      notes: [workflowNotes[mode], acceptedFormats].filter(Boolean).join(' '),
    },
  };
}

export const SEEDANCE_2_5_FLASH_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-2-5-flash',
    marketingName: 'Seedance 2.5 Flash',
    cardTitle: 'Seedance 2.5 Flash',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '2.5 Flash',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote:
      'Your final price is calculated before generation from the selected duration, resolution, and inputs.',
    engine: SEEDANCE_2_5_ENGINE,
    modes: SEEDANCE_2_5_MODES.map(seedance25Mode),
    defaultFalModelId: BYTEPLUS_SEEDANCE_2_5_FLASH_ENDPOINTS.t2v,
    seo: {
      title: 'Seedance 2.5 Flash — MaxVideoAI',
      description: 'Seedance 2.5 Flash video generation workflows on MaxVideoAI.',
      canonicalPath: '/models/seedance-2-5-flash',
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
