import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const LTX_2_3_FAST_ENGINE: EngineCaps = {
  id: 'ltx-2-3-fast',
  label: 'LTX 2.3 Fast',
  provider: 'Lightricks',
  version: '2.3 Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 20,
  resolutions: ['1080p', '1440p', '4k'],
  aspectRatios: ['16:9', '9:16'],
  fps: [24, 25, 48, 50],
  audio: true,
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
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Used as the first frame for image-to-video generation.',
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
        label: 'Duration (seconds)',
        values: ['6', '8', '10', '12', '14', '16', '18', '20'],
        default: '6',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1080p', '1440p', '4k'],
        default: '1080p',
      },
      {
        id: 'fps',
        type: 'enum',
        label: 'Frames per second',
        values: ['24', '25', '48', '50'],
        default: '25',
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional end frame for a start-to-end transition.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'guidance_scale',
        type: 'number',
        label: 'Guidance scale',
        description: 'Adjust prompt adherence for LTX 2.3 Fast.',
        modes: ['i2v'],
        min: 1,
        max: 50,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heif'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 4,
      byResolution: {
        '1080p': 4,
        '1440p': 8,
        '4k': 16,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.04,
    byResolution: {
      '1080p': 0.04,
      '1440p': 0.08,
      '4k': 0.16,
    },
    currency: 'USD',
    notes: '$0.31 per 6s @1080p, $0.62 @1440p, $1.25 @4K. Durations above 10s require 1080p / 25 fps.',
  },
  updatedAt: '2026-03-06T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'lightricks',
    modelSlug: 'fal-ai/ltx-2.3/text-to-video/fast',
  },
  availability: 'available',
  brandId: 'lightricks',
};


export const LTX_2_3_FAST_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'ltx-2-3-fast',
    marketingName: 'LTX 2.3 Fast',
    cardTitle: 'LTX 2.3 Fast – quick text and image video',
    provider: 'Lightricks',
    brandId: 'lightricks',
    versionLabel: '2.3 Fast',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: LTX_2_3_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/ltx-2.3/text-to-video/fast',
        ui: {
          modes: ['t2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          fps: [24, 25, 48, 50],
          notes: 'Fast public LTX 2.3 path for text-to-video. Durations above 10s require 1080p / 25 fps.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/ltx-2.3/image-to-video/fast',
        ui: {
          modes: ['i2v'],
          duration: { options: [6, 8, 10, 12, 14, 16, 18, 20], default: 6 },
          resolution: ['1080p', '1440p', '4k'],
          aspectRatio: ['auto', '16:9', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'heif'],
          maxUploadMB: 25,
          audioToggle: true,
          fps: [24, 25, 48, 50],
          notes: 'Fast public LTX 2.3 path for image-to-video with optional end frame. Durations above 10s require 1080p / 25 fps.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/ltx-2.3/text-to-video/fast',
    seo: {
      title: 'LTX 2.3 Fast AI Video – Fast Text & Image to Video | MaxVideoAI',
      description:
        'Generate fast AI video with LTX 2.3 Fast on MaxVideoAI. Text and image workflows support 6–20s clips, 1080p/1440p/4K, native audio, and 25/50 fps options.',
      canonicalPath: '/models/ltx-2-3-fast',
    },
    type: 'textImage',
    seoText:
      'Run LTX 2.3 Fast for lightweight text-to-video and image-to-video passes with full fast controls: 6–20 second clips, 1080p to 4K, 24/25/48/50 fps, native audio, and optional start-to-end image transitions.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/bb626d67-1a33-4088-ae1f-ccb99738eabc.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/bb626d67-1a33-4088-ae1f-ccb99738eabc.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/1bd62e34-0e55-4f49-b434-295276b991d4-job_d895c3b0-562a-4e36-ae06-4ce083a47126.jpg',
      altText: 'LTX 2.3 Fast temporary demo clip using LTX 2 Fast media',
    },
    prompts: [
      {
        title: 'Fast product reveal',
        prompt: 'A sleek product reveal shot with reflective lighting, subtle camera push, clean commercial motion, 16:9',
        mode: 't2v',
      },
      {
        title: 'Animate a still',
        prompt: 'Bring this frame to life with a subtle camera move, layered parallax, and realistic motion',
        mode: 'i2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 31,
      durationSeconds: 6,
      resolution: '1080p',
      label: '6s 1080p clip',
    },
    promptExample:
      'A polished product shot on a mirrored pedestal, cinematic reflections, slow camera push, soft atmospheric haze',
  },
];
