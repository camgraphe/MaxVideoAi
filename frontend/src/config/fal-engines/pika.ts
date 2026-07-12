import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const PIKA_TEXT_TO_VIDEO_ENGINE: EngineCaps = {
  id: 'pika-text-to-video',
  label: 'Pika 2.2 Text & Image to Video',
  provider: 'Pika',
  version: '2.2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {
    cfg_scale: {
      min: 0,
      max: 1,
      default: 0.5,
      step: 0.05,
    },
  },
  inputLimits: {
    imageMaxMB: 25,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'observed',
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
    ],
    optional: [
      {
        id: 'duration_seconds',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10'],
        default: '5',
        min: 5,
        max: 10,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
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
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 4,
      byResolution: {
        '720p': 4,
        '1080p': 9,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.04,
    byResolution: {
      '720p': 0.04,
      '1080p': 0.09,
    },
    currency: 'USD',
    notes: '$0.20 per 5s / $0.40 per 10s at 720p, $0.45 per 5s / $0.90 per 10s at 1080p',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'pika',
    modelSlug: 'fal-ai/pika/v2.2/text-to-video',
  },
  availability: 'available',
  brandId: 'pika',
};


export const PIKA_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'pika-text-to-video',
    marketingName: 'Pika 2.2 Text & Image to Video',
    cardTitle: 'Pika 2.2',
    provider: 'Pika',
    brandId: 'pika',
    versionLabel: '2.2',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: PIKA_TEXT_TO_VIDEO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/pika/v2.2/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/pika/v2.2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:5', '5:4', '3:2', '2:3'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          maxUploadMB: 25,
          audioToggle: false,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/pika/v2.2/text-to-video',
    seo: {
      title: 'Pika 2.2 – Stylized Text & Image to Video',
      description:
        'Generate stylized AI video from prompts or animate uploaded stills using Pika 2.2. Perfect for short-form loops without audio via MaxVideoAI.',
      canonicalPath: '/models/pika-text-to-video',
    },
    type: 'textImage',
    seoText:
      'Create fast, fun, stylized AI videos with Pika. Ideal for 5–10 second animations in vertical or square formats—no audio, fast rendering, high visual impact.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/5e0ea541-cd07-48e9-841d-42b5679e1f3f.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/5e0ea541-cd07-48e9-841d-42b5679e1f3f.mp4',
      imagePath: '/hero/pika-22.jpg',
      altText: 'Stylized short clip made with Pika 2.2',
    },
    prompts: [
      {
        title: 'Pixel cat portal hop',
        prompt: 'A pixel-art cat jumping through portals, retro arcade backdrop, rainbow glitch trails, snappy 2D animation',
        mode: 't2v',
      },
      {
        title: 'Comic pop intro',
        prompt: 'Comic-book style splash screen with bold text bursts, camera punch-in, bright halftone textures',
        mode: 't2v',
      },
      {
        title: 'Animate a sketch',
        prompt: 'Animate the uploaded storyboard still into a sweeping camera move, add parallax and light leaks',
        mode: 'i2v',
        notes: 'Upload a still frame under Reference images to drive the animation.',
      },
    ],
    faqs: [
      {
        question: 'Can I create both 9:16 and 16:9 clips with Pika 2.2?',
        answer: 'Yes. Select your aspect ratio before queuing and the render will match without extra tooling.',
      },
      {
        question: 'Does Pika 2.2 include audio?',
        answer: 'Base renders are silent. Layer audio afterwards in MaxVideoAI using the soundtrack add-on.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 30,
      durationSeconds: 5,
      resolution: '720p',
      label: 'Silent clip',
    },
    promptExample:
      'A cartoon astronaut floating through candy space, bubble gum planets, comic-book animation style',
  },
];
