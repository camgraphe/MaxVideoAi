import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const WAN_2_5_ENGINE: EngineCaps = {
  id: 'wan-2-5',
  label: 'Wan 2.5 Text & Image to Video',
  provider: 'Wan',
  version: '2.5 Preview',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 10,
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
    videoMaxMB: 15,
    promptMaxChars: 800,
    promptMaxCharsSource: 'official',
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
        label: 'Reference image',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'audio_url',
        type: 'text',
        label: 'Audio URL',
        description: 'Optional WAV/MP3 soundtrack (3-30s, ≤15MB).',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10'],
        default: '5',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['480p', '720p', '1080p'],
        default: '1080p',
      },
      {
        id: 'negative_prompt',
        type: 'text',
        label: 'Negative prompt',
      },
      {
        id: 'enable_prompt_expansion',
        type: 'enum',
        label: 'Prompt expansion',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'enable_safety_checker',
        type: 'enum',
        label: 'Safety checker',
        values: ['true', 'false'],
        default: 'true',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 5,
      byResolution: {
        '480p': 5,
        '720p': 10,
        '1080p': 15,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.05,
    byResolution: {
      '480p': 0.05,
      '720p': 0.1,
      '1080p': 0.15,
    },
    currency: 'USD',
    notes: '$0.25 per 5s @480p, $0.50 per 5s @720p, $0.75 per 5s @1080p',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'wan',
    modelSlug: 'fal-ai/wan-25-preview/text-to-video',
  },
  availability: 'available',
  brandId: 'wan',
};


export const WAN_2_5_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'wan-2-5',
    marketingName: 'Wan 2.5 Text & Image to Video',
    cardTitle: 'Wan 2.5',
    provider: 'Wan',
    brandId: 'wan',
    versionLabel: 'Preview',
    availability: 'available',
    logoPolicy: 'textOnly',
    isLegacy: true,
    engine: WAN_2_5_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/wan-25-preview/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['480p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          audioToggle: true,
          notes: 'Optional WAV/MP3 soundtrack trims to 5 or 10 seconds.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/wan-25-preview/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['480p', '720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload a single still (360–2000px) to drive the motion.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/wan-25-preview/text-to-video',
    seo: {
      title: 'Wan 2.5 – Audio-ready Text or Image to Video',
      description:
        'Generate Wan 2.5 preview clips from prompts or single reference stills, complete with optional audio and 480p–1080p tiers.',
      canonicalPath: '/models/wan-2-5',
    },
    type: 'textImage',
    seoText:
      'Wan 2.5 lets you storyboard cinematic beats with optional audio baked in. Swap between 5 or 10 second renders, 480p to 1080p resolutions, and prompt expansion to squeeze more detail out of shorter briefs.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/d5fd3f15-47c7-4be6-a0cd-e0828524246e.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/d5fd3f15-47c7-4be6-a0cd-e0828524246e.mp4',
      imagePath: '/hero/wan-25.jpg',
      altText: 'Wan 2.5 render of a dragon warrior in golden light.',
    },
    prompts: [
      {
        title: 'Dragon warrior hero shot',
        prompt:
          'The white dragon warrior stands still as the camera circles slowly, volumetric haze, heroic lighting, triumphant orchestral swells.',
        mode: 't2v',
      },
      {
        title: 'Portrait push-in',
        prompt:
          'Animate the uploaded founder portrait into a confident walk-and-talk moment, warm lens flare, subtle handheld sway, ambient office score.',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'Does Wan 2.5 support background music?',
        answer:
          'Yes. Provide a WAV or MP3 between 3 and 30 seconds, and Wan trims or loops it to your 5 or 10 second render length.',
      },
      {
        question: 'Can I disable prompt expansion or the safety checker?',
        answer:
          'Toggle both options in Advanced settings. Leave them on for exploratory prompts or turn them off when you need literal output.',
      },
      {
        question: 'What image inputs work best for i2v?',
        answer:
          'Upload a clean 360px–2000px still. Wan keeps the first frame intact, so provide a polished board/screenshot whenever possible.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 75,
      durationSeconds: 5,
      resolution: '1080p',
      label: '1080p clip',
    },
    promptExample:
      'Slow aerial glide over a futuristic harbor at sunrise, neon reflections on water, synthwave soundtrack, ends on a close-up of the flagship.',
  },
];
