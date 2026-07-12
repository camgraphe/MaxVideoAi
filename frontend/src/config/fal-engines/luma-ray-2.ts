import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  LUMA_RAY2_ASPECT_RATIO_VALUES,
  LUMA_RAY2_DURATION_VALUES,
  LUMA_RAY2_MODIFY_MODE_VALUES,
  LUMA_RAY2_REFRAME_ASPECT_RATIO_VALUES,
  LUMA_RAY2_RESOLUTION_VALUES,
} from './luma-ray-shared';

const LUMA_RAY2_ENGINE: EngineCaps = {
  id: 'lumaRay2',
  label: 'Luma Ray 2',
  provider: 'Luma AI',
  version: 'Ray 2',
  status: 'live',
  latencyTier: 'standard',
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
    modelSlug: 'fal-ai/luma-dream-machine/ray-2',
  },
  availability: 'available',
  brandId: 'luma',
};


export const LUMA_RAY_2_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'lumaRay2',
    marketingName: 'Luma Ray 2',
    cardTitle: 'Ray 2',
    provider: 'Luma AI',
    brandId: 'luma',
    versionLabel: 'Ray 2',
    availability: 'available',
    logoPolicy: 'logoAllowed',
    isLegacy: true,
    engine: LUMA_RAY2_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2',
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
        falModelId: 'fal-ai/luma-dream-machine/ray-2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['5s', '9s'], default: '5s' },
          resolution: ['540p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 10,
          audioToggle: false,
          notes: 'Animate one still with optional end-frame guidance and loop control.',
        },
      },
      {
        mode: 'v2v',
        falModelId: 'fal-ai/luma-dream-machine/ray-2/modify',
        ui: {
          modes: ['v2v'],
          notes: 'Modify a source clip with optional prompt and reference-image guidance plus provider adherence presets.',
        },
      },
      {
        mode: 'reframe',
        falModelId: 'fal-ai/luma-dream-machine/ray-2/reframe',
        ui: {
          modes: ['reframe'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'],
          notes: 'Reframe an existing source clip into a new aspect ratio with optional prompt, reference image, and crop controls.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/luma-dream-machine/ray-2',
    seo: {
      title: 'Luma Ray 2 – Legacy Generate, Modify and Reframe AI Video',
      description:
        'Use Luma Ray 2 as a previous-generation Luma route for legacy text-to-video, image-to-video, modify, and reframe workflows, while starting new Luma edit work on Ray 3.2.',
      canonicalPath: '/models/luma-ray-2',
    },
    type: 'Text, image, modify, reframe',
    seoText:
      'Luma Ray 2 remains available on MaxVideoAI as a legacy-compatible Luma route for older text generation, still-to-video, source-video modification, and reframe workflows. Ray 3.2 is the current Luma entry point for new Modify, guide/keyframe, and Reframe work.',
    demoUrl: '/hero/luma-dream.mp4',
    media: {
      videoUrl: '/hero/luma-dream.mp4',
      imagePath: '/hero/luma-dream.jpg',
      altText: 'Cinematic demo render from Luma Ray 2',
    },
    prompts: [
      {
        title: 'Night tram sequence',
        prompt:
          'Rain-soaked European tram gliding through a neon city at blue hour, cinematic reflections on cobblestones, slow tracking camera, controlled filmic motion.',
        mode: 't2v',
      },
      {
        title: 'Fashion still to motion',
        prompt:
          'Animate the uploaded fashion editorial still into a subtle forward dolly, fabric movement and soft hair motion, preserve facial identity and studio lighting.',
        mode: 'i2v',
        notes: 'Add an end frame when you need tighter closing composition control.',
      },
      {
        title: 'Looping product orbit',
        prompt:
          'Luxury fragrance bottle on black glass, smooth orbiting camera, precise highlight roll-off, seamless loop that returns naturally to the opening pose.',
        mode: 't2v',
      },
      {
        title: 'Wardrobe-aware modify pass',
        prompt:
          'Modify the uploaded runway clip to keep the subject centered while refreshing the wardrobe texture to metallic silk, preserve camera move and pacing, flex_2.',
        mode: 'v2v',
        notes: 'Upload a source video, then choose a Modify strength preset from adhere to reimagine.',
      },
      {
        title: 'Vertical reframe for social',
        prompt:
          'Reframe the uploaded landscape fashion clip into a clean 9:16 vertical crop, keep the face and shoulders prioritized, maintain motion continuity.',
        mode: 'reframe',
      },
    ],
    faqs: [
      {
        question: 'How does Luma Ray 2 fit next to Ray 3.2?',
        answer:
          'Ray 2 stays available for legacy-compatible text-to-video, image-to-video, modify, and reframe workflows. For new Luma source-video edits, guide/keyframes, and reframing work, Ray 3.2 is the current route.',
      },
      {
        question: 'Which options are exposed per workflow?',
        answer:
          'Generate modes keep 5 s or 9 s duration, 540p to 1080p, cinematic aspect ratios, optional loop, and optional end image for image-driven shots. Modify adds adherence presets, and Reframe adds new aspect-ratio plus crop-window controls on a source clip.',
      },
    ],
    promptExample:
      'Elegant dolly shot through a boutique hotel lobby at dusk, warm practical lighting, reflective marble floor, cinematic motion with restrained pacing.',
  },
];
