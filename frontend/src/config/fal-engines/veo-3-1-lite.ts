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
  modes: ['t2v', 'i2v', 'fl2v'],
  maxDurationSec: 8,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['auto', '16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 8,
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
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4s', '6s', '8s'],
        default: '8s',
        min: 4,
        max: 8,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '16:9', '9:16'],
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
        id: 'auto_fix',
        type: 'enum',
        label: 'Auto fix policy',
        values: ['true', 'false'],
        default: 'false',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
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
  },
  pricing: {
    unit: 'USD/s',
    base: 0.05,
    currency: 'USD',
    notes: '$0.05/s at 720p, $0.08/s at 1080p (audio always on)',
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
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/veo3.1/lite/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: false,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 8,
          notes: 'Animate one still with Veo 3.1 Lite. Audio is always included, and 1080p requires an 8 second render.',
        },
      },
      {
        mode: 'fl2v',
        falModelId: 'fal-ai/veo3.1/lite/first-last-frame-to-video',
        ui: {
          modes: ['fl2v'],
          duration: { options: ['4s', '6s', '8s'], default: '8s' },
          resolution: ['720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          audioToggle: false,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 8,
          notes: 'Bridge two keyframes inside Lite when you need a guided ending. Audio is always generated, and 1080p requires 8 seconds.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/veo3.1/lite',
    seo: {
      title: 'Veo 3.1 Lite – Text, Start Image & First/Last Video',
      description:
        'Use Veo 3.1 Lite for lower-cost text prompts, start-image animation, and optional first/last-frame control with always-on native audio inside one unified MaxVideoAI model page.',
      canonicalPath: '/models/veo-3-1-lite',
    },
    type: 'Text, start image, last frame',
    seoText:
      'Veo 3.1 Lite keeps the unified Veo workflow on MaxVideoAI for text prompts, single start-image animation, and optional first/last-frame control, with native audio always included and lower-cost 720p or 1080p pricing.',
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
          'Veo 3.1 Lite supports text-to-video, start-image animation, and first/last-frame transitions. Multi-reference stills and extend workflows remain reserved for other Veo tiers.',
      },
      {
        question: 'Can I disable audio in Veo 3.1 Lite?',
        answer: 'No. Veo 3.1 Lite has native audio always on, so MaxVideoAI keeps audio locked on for this tier.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 40,
      durationSeconds: 8,
      resolution: '720p',
      label: 'Audio always on',
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
        suggestOpponents: ['veo-3-1-fast', 'veo-3-1', 'ltx-2-3-fast'],
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
