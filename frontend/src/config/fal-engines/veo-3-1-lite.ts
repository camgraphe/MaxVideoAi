import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const VEO_3_1_LITE_ENGINE: EngineCaps = {
  id: 'veo-3-1-lite',
  label: 'Google Veo 3.1 Lite',
  provider: 'Google',
  version: '3.1 Lite',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'fl2v', 'extend'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 20,
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
        description: 'Use one still image as the starting frame for the shot.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'first_frame_url',
        type: 'image',
        label: 'Start image',
        description: 'Opening frame for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'last_frame_url',
        type: 'image',
        label: 'Last frame',
        description: 'Target ending image for the shot.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Extend an existing Veo Lite render from a source clip URL or upload.',
        modes: ['extend'],
        requiredInModes: ['extend'],
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
        values: ['4s', '6s', '8s'],
        default: '8s',
        modes: ['t2v', 'i2v', 'fl2v'],
        min: 4,
        max: 8,
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
        values: ['720p', '1080p'],
        default: '720p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Lock motion & noise for iterative runs.',
      },
      {
        id: 'person_generation',
        type: 'enum',
        label: 'People generation',
        values: ['allow_adult', 'dont_allow'],
        default: 'allow_adult',
      },
      {
        id: 'compression_quality',
        type: 'enum',
        label: 'Compression quality',
        values: ['optimized', 'lossless'],
        default: 'optimized',
      },
      {
        id: 'resize_mode',
        type: 'enum',
        label: 'Resize mode',
        values: ['pad', 'crop'],
        default: 'pad',
        modes: ['i2v', 'fl2v'],
      },
      {
        id: 'generate_audio',
        type: 'enum',
        label: 'Generate audio',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Extension duration (seconds)',
        modes: ['extend'],
        values: ['7s'],
        default: '7s',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 5,
      byResolution: {
        '720p': 5,
        '1080p': 8,
      },
    },
    addons: {
      audio_off: {
        perSecondCentsByResolution: {
          '720p': -2,
          '1080p': -3,
        },
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.05,
    byResolution: {
      '720p': 0.05,
      '1080p': 0.08,
    },
    currency: 'USD',
    notes: '$0.05/s at 720p with audio, $0.08/s at 1080p with audio; audio off is $0.03/s at 720p and $0.05/s at 1080p',
  },
  updatedAt: '2026-04-02T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google-veo',
    modelSlug: 'fal-ai/veo3.1/lite',
  },
  availability: 'available',
  brandId: 'google-veo',
};


export const VEO_3_1_LITE_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'veo-3-1-lite',
    modelSlug: 'veo-3-1-lite',
    marketingName: 'Google Veo 3.1 Lite',
    cardTitle: 'Veo 3.1 Lite',
    provider: 'Google',
    brandId: 'google-veo',
    family: 'veo',
    versionLabel: '3.1 Lite',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: VEO_3_1_LITE_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/veo3.1/lite',
        ui: {
          modes: ['t2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/lite/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png'],
          maxUploadMB: 20,
          notes: 'Animate one still with Veo 3.1 Lite. Disable audio when you want the lower-cost video-only path.',
        },
      },
      {
        mode: 'fl2v',
        falModelId: 'fal-ai/veo3.1/lite/first-last-frame-to-video',
        ui: {
          modes: ['fl2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png'],
          maxUploadMB: 20,
          notes: 'Bridge two keyframes inside Lite when you need a guided ending. Disable audio when you want the lower-cost video-only path.',
        },
      },
      {
        mode: 'extend',
        falModelId: 'fal-ai/veo3.1/lite/extend-video',
        ui: {
          modes: ['extend'],
          duration: { options: ['7s'], default: '7s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Extend an existing Veo Lite MP4 by 7 seconds. Lite does not support 4K output.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/lite',
    seo: {
      title: 'Veo 3.1 Lite – Text, Start Image, First/Last & Extend Video',
      description:
        'Use Veo 3.1 Lite for lower-cost text prompts, start-image animation, optional first/last-frame control, and Extend with optional native audio inside one unified MaxVideoAI model page.',
      canonicalPath: '/models/veo-3-1-lite',
    },
    type: 'Text, start image, last frame, extend',
    seoText:
      'Veo 3.1 Lite keeps the unified Veo workflow on MaxVideoAI for text prompts, single start-image animation, optional first/last-frame control, and 7-second Extend with native audio controls and lower-cost 720p or 1080p pricing.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/a01fb42f-92d9-4312-b1a1-a721fae5400b.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/a01fb42f-92d9-4312-b1a1-a721fae5400b.mp4',
      imagePath: '/hero/veo-3-1-hero.jpg',
      altText: 'Demo video generated with Veo 3.1 Lite',
    },
    prompts: [
      {
        title: 'Fast social hook',
        prompt: 'A late-night ramen counter in Tokyo, soft steam drifting upward, quick handheld push toward the chef plating one bowl, ambient street chatter and kitchen sound.',
        mode: 't2v',
      },
      {
        title: 'Start-image motion test',
        prompt: 'Animate this still into a clean 8 second push-in with restrained subject motion, keep the palette grounded and the soundtrack subtle.',
        mode: 'i2v',
        notes: 'Use one start image when you want lower-cost motion tests before moving to Veo 3.1 or Veo 3.1 Fast.',
      },
      {
        title: 'Keyframe bridge',
        prompt: 'Bridge from the approved packshot to the final lifestyle frame in one smooth motion, keep product silhouette stable and reveal the wider scene gradually.',
        mode: 'fl2v',
        notes: 'Add a Last frame in Generate Video to steer the ending without switching engines.',
      },
    ],
    faqs: [
      {
        question: 'What workflows are available in Veo 3.1 Lite?',
        answer:
          'Veo 3.1 Lite supports text-to-video, start-image animation, first/last-frame transitions, and 7-second Extend. Multi-reference stills remain reserved for other Veo tiers.',
      },
      {
        question: 'Can I disable audio in Veo 3.1 Lite?',
        answer:
          'Yes. MaxVideoAI exposes the Veo 3.1 Lite audio toggle, so you can generate video with native audio or use the lower-cost video-only path.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 40,
      durationSeconds: 8,
      resolution: '720p',
      label: 'Audio optional',
    },
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
        suggestOpponents: ['veo-3-1-fast', 'veo-3-1', 'sora-2'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 4,
        variantGroup: 'veo-3-1',
        variantLabel: 'Lite',
      },
      pricing: {
        includeInEstimator: true,
      },
    },
    promptExample:
      'A cozy bakery kitchen at sunrise, soft dolly-in, flour dust in the light, baker plating one pastry, natural ambience and room tone.',
  },
];
