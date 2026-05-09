import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  LUMA_RAY2_ASPECT_RATIO_VALUES,
  LUMA_RAY2_DURATION_VALUES,
  LUMA_RAY2_MODIFY_MODE_VALUES,
  LUMA_RAY2_REFRAME_ASPECT_RATIO_VALUES,
  LUMA_RAY2_RESOLUTION_VALUES,
} from './luma-ray-shared';

const LUMA_RAY2_FLASH_ENGINE: EngineCaps = {
  id: 'lumaRay2_flash',
  label: 'Luma Ray 2 Flash',
  provider: 'Luma AI',
  version: 'Ray 2 Flash',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'v2v', 'reframe'],
  maxDurationSec: 9,
  resolutions: ['540p', '720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
    videoMaxMB: 500,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'i2v'],
        requiredInModes: ['t2v', 'i2v'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Use one still image to anchor the opening frame for image-to-video.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Upload the video to modify or reframe.',
        modes: ['v2v', 'reframe'],
        requiredInModes: ['v2v', 'reframe'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Optional text guidance for modify and reframe workflows.',
        modes: ['v2v', 'reframe'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Reference image',
        description: 'Optional still reference to steer styling or composition during modify or reframe.',
        modes: ['v2v', 'reframe'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional closing frame for a guided start-to-end transition.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: [...LUMA_RAY2_DURATION_VALUES],
        default: '5s',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: [...LUMA_RAY2_ASPECT_RATIO_VALUES],
        default: '16:9',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: [...LUMA_RAY2_RESOLUTION_VALUES],
        default: '540p',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'loop',
        type: 'boolean',
        label: 'Loop video',
        default: false,
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'mode',
        type: 'enum',
        label: 'Modify strength',
        description: 'Choose how tightly the source clip should follow the original motion and composition.',
        values: [...LUMA_RAY2_MODIFY_MODE_VALUES],
        default: 'flex_1',
        modes: ['v2v'],
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Reframe aspect ratio',
        description: 'Choose the new framing for the output clip.',
        values: [...LUMA_RAY2_REFRAME_ASPECT_RATIO_VALUES],
        default: '9:16',
        modes: ['reframe'],
      },
      {
        id: 'grid_position_x',
        type: 'number',
        label: 'Grid position X',
        description: 'Optional horizontal grid anchor for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'grid_position_y',
        type: 'number',
        label: 'Grid position Y',
        description: 'Optional vertical grid anchor for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'x_start',
        type: 'number',
        label: 'Crop start X',
        description: 'Optional left crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'x_end',
        type: 'number',
        label: 'Crop end X',
        description: 'Optional right crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'y_start',
        type: 'number',
        label: 'Crop start Y',
        description: 'Optional top crop boundary for the reframe window.',
        modes: ['reframe'],
      },
      {
        id: 'y_end',
        type: 'number',
        label: 'Crop end Y',
        description: 'Optional bottom crop boundary for the reframe window.',
        modes: ['reframe'],
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm', 'm4v', 'gif'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 500,
    },
  },
  updatedAt: '2026-04-02T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'luma',
    modelSlug: 'fal-ai/luma-dream-machine/ray-2-flash',
  },
  availability: 'available',
  brandId: 'luma',
};


export const LUMA_RAY_2_FLASH_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'lumaRay2_flash',
    modelSlug: 'luma-ray-2-flash',
    marketingName: 'Luma Ray 2 Flash',
    cardTitle: 'Ray 2 Flash',
    provider: 'Luma AI',
    brandId: 'luma',
    family: 'luma',
    versionLabel: 'Ray 2 Flash',
    availability: 'available',
    logoPolicy: 'logoAllowed',
    engine: LUMA_RAY2_FLASH_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash',
        ui: {
          modes: ['t2v'],
          duration: { options: ['5s', '9s'], default: '5s' },
          resolution: ['540p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['5s', '9s'], default: '5s' },
          resolution: ['540p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 10,
          audioToggle: false,
          notes: 'Use Flash for faster cinematic drafts with the same visible settings surface.',
        },
      },
      {
        mode: 'v2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash/modify',
        ui: {
          modes: ['v2v'],
          notes: 'Modify a source clip quickly with the same adherence and reimagination presets exposed in Flash.',
        },
      },
      {
        mode: 'reframe',
        falModelId: 'fal-ai/luma-dream-machine/ray-2-flash/reframe',
        ui: {
          modes: ['reframe'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
          notes: 'Reframe an existing source clip into a new format with the faster Flash variant.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/luma-dream-machine/ray-2-flash',
    seo: {
      title: 'Luma Ray 2 Flash – Faster Generate, Modify and Reframe Workflows',
      description:
        'Use Luma Ray 2 Flash for quicker text-to-video, image-to-video, modify, and reframe iterations with the same Ray 2 workflow family, 5 s or 9 s generation shots, and faster source-video editing.',
      canonicalPath: '/models/luma-ray-2-flash',
    },
    type: 'Text, image, modify, reframe',
    seoText:
      'Luma Ray 2 Flash keeps the full Ray 2 workflow surface aligned while prioritizing quicker turnarounds for cinematic drafts, source-video modification, vertical reframes, and reference animation.',
    demoUrl: '/hero/luma-ray2-flash.mp4',
    media: {
      videoUrl: '/hero/luma-ray2-flash.mp4',
      imagePath: '/hero/luma-ray2-flash.jpg',
      altText: 'Fast draft render from Luma Ray 2 Flash',
    },
    prompts: [
      {
        title: 'Fast concept tease',
        prompt:
          'Futuristic sports car reveal in a narrow tunnel, quick cinematic push-in, wet asphalt reflections, bold contrast, energetic but stable motion.',
        mode: 't2v',
      },
      {
        title: 'Storyboard animatic',
        prompt:
          'Animate the uploaded storyboard frame into a fast previs shot with clear subject motion, camera parallax, and readable lighting transitions.',
        mode: 'i2v',
        notes: 'Best suited to rapid iteration before switching the approved shot to Ray 2.',
      },
      {
        title: 'Fast modify iteration',
        prompt:
          'Modify the uploaded product video into a cleaner showroom look, preserve the camera path and timing, flex_1.',
        mode: 'v2v',
      },
      {
        title: 'Social crop reframe',
        prompt:
          'Reframe the uploaded horizontal teaser into a 9:16 social crop with the product kept in the upper-center third throughout the move.',
        mode: 'reframe',
      },
    ],
    faqs: [
      {
        question: 'Why keep Ray 2 and Ray 2 Flash as the only public Luma models?',
        answer:
          'The family stays simple at the model level, but each model now exposes the real workflows inside it: generate, modify, and reframe.',
      },
      {
        question: 'Does Flash use a different pricing path?',
        answer:
          'Yes. Flash keeps its own pricing path for generate, modify, and reframe workflows, while still allowing environment overrides when you want to tune the rollout.',
      },
    ],
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: true,
        includeInFamilyCopy: true,
      },
      compare: {
        suggestOpponents: ['luma-ray-2', 'veo-3-1-lite', 'ltx-2-3-fast'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 6,
        variantGroup: 'luma-ray-2',
        variantLabel: 'Ray 2 Flash',
      },
      pricing: {
        includeInEstimator: false,
      },
    },
    promptExample:
      'Moody concept trailer shot of a lone motorcyclist entering a foggy tunnel, fast turnaround, cinematic highlights, clear subject silhouette.',
  },
];
