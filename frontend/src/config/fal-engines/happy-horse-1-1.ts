import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  HAPPY_HORSE_1_1_ASPECT_RATIOS,
  HAPPY_HORSE_1_1_ENDPOINTS,
  HAPPY_HORSE_DURATION_OPTIONS,
} from './launch-config';

const HAPPY_HORSE_1_1_ENGINE: EngineCaps = {
  id: 'happy-horse-1-1',
  label: 'Happy Horse 1.1',
  provider: 'Alibaba',
  version: '1.1',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 15,
  resolutions: ['720p', '1080p'],
  aspectRatios: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 20,
    promptMaxChars: 2500,
    promptMaxCharsSource: 'official',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'ref2v'],
        requiredInModes: ['t2v', 'ref2v'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Start image',
        description: 'Used as the first frame for Happy Horse 1.1 image-to-video generation.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images (1-9)',
        description:
          'Reference subjects with character1, character2, and up to character9 in the prompt. Requires 1-9 JPEG, JPG, PNG, or WEBP references.',
        modes: ['ref2v'],
        requiredInModes: ['ref2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
        slotLabelPattern: 'character{n}',
      },
    ],
    optional: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Optional animation guidance for image-to-video.',
        modes: ['i2v'],
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        modes: ['t2v', 'i2v', 'ref2v'],
        values: HAPPY_HORSE_DURATION_OPTIONS.map(String),
        default: '5',
        min: 3,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['t2v', 'ref2v'],
        values: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        modes: ['t2v', 'i2v', 'ref2v'],
        values: ['720p', '1080p'],
        default: '1080p',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Optional random seed for reproducible Happy Horse 1.1 generations. Accepted range: 0-2147483647.',
        modes: ['t2v', 'i2v', 'ref2v'],
        min: 0,
        max: 2147483647,
        step: 1,
      },
      {
        id: 'enable_safety_checker',
        type: 'boolean',
        label: 'Safety checker',
        description: 'Enable provider input and output moderation.',
        modes: ['t2v', 'i2v', 'ref2v'],
        default: true,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
      maxImageSizeMB: 20,
      minImageSidePx: 300,
      minReferenceImageSidePx: 400,
      imageAspectRatioRange: '1:2.5 to 2.5:1',
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 14,
      byResolution: {
        '720p': 14,
        '1080p': 18,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.14,
    byResolution: {
      '720p': 0.14,
      '1080p': 0.18,
    },
    currency: 'USD',
    notes:
      'Provider cost: $0.14/s for 720p and $0.18/s for 1080p on Happy Horse 1.1 text, image, and reference-to-video runs. MaxVideoAI display prices add platform margin before showing quotes.',
  },
  updatedAt: '2026-06-22T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'alibaba',
    modelSlug: HAPPY_HORSE_1_1_ENDPOINTS.t2v,
  },
  availability: 'available',
  brandId: 'alibaba',
  brandAssetPolicy: {
    logoAllowed: false,
    textOnly: true,
    usageNotes: 'Use text-only Alibaba attribution until an approved logo asset and usage guidance are available.',
  },
  modeCaps: {
    t2v: {
      modes: ['t2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      aspectRatio: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
      audioToggle: false,
      notes: 'Text-to-video with native synchronized audio and multilingual lip-sync.',
    },
    i2v: {
      modes: ['i2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      acceptsImageFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
      maxUploadMB: 20,
      audioToggle: false,
      notes: 'Animate one start image with optional prompt guidance. Aspect ratio is inferred from the source image.',
    },
    ref2v: {
      modes: ['ref2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      aspectRatio: [...HAPPY_HORSE_1_1_ASPECT_RATIOS],
      acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxUploadMB: 10,
      audioToggle: false,
      notes: 'Reference-to-video workflow with 1-9 image references and character1..character9 prompt anchors.',
    },
  },
};

export const HAPPY_HORSE_1_1_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'happy-horse-1-1',
    modelSlug: 'happy-horse-1-1',
    marketingName: 'Happy Horse 1.1',
    cardTitle: 'Happy Horse 1.1 - Alibaba native-audio video model',
    provider: 'Alibaba',
    brandId: 'alibaba',
    family: 'happy-horse',
    versionLabel: '1.1',
    availability: 'available',
    logoPolicy: 'logoAllowed',
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
        suggestOpponents: ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'sora-2-pro', 'happy-horse-1-0'],
        publishedPairs: ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'sora-2-pro', 'happy-horse-1-0'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 6,
        variantGroup: 'happy-horse',
        variantLabel: '1.1',
      },
      pricing: {
        includeInEstimator: true,
        featuredScenario: 'happy-horse-1-1-native-audio-video',
      },
    },
    engine: HAPPY_HORSE_1_1_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: HAPPY_HORSE_1_1_ENDPOINTS.t2v,
        ui: HAPPY_HORSE_1_1_ENGINE.modeCaps?.t2v ?? { modes: ['t2v'] },
      },
      {
        mode: 'i2v',
        falModelId: HAPPY_HORSE_1_1_ENDPOINTS.i2v,
        ui: HAPPY_HORSE_1_1_ENGINE.modeCaps?.i2v ?? { modes: ['i2v'] },
      },
      {
        mode: 'ref2v',
        falModelId: HAPPY_HORSE_1_1_ENDPOINTS.ref2v,
        ui: HAPPY_HORSE_1_1_ENGINE.modeCaps?.ref2v ?? { modes: ['ref2v'] },
      },
    ],
    defaultFalModelId: HAPPY_HORSE_1_1_ENDPOINTS.t2v,
    seo: {
      title: 'Happy Horse 1.1 - Alibaba Native-Audio AI Video Model | MaxVideoAI',
      description:
        'Generate Happy Horse 1.1 videos on MaxVideoAI with text, image, and reference-to-video workflows plus native synchronized audio and lip-sync.',
      canonicalPath: '/models/happy-horse-1-1',
    },
    type: 'textImageReferenceVideo',
    seoText:
      'Happy Horse 1.1 combines text-to-video, image-to-video, and reference-image generation in one Alibaba model card, with native audio and lip-sync treated as part of the generation.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/69f25df5-9354-4387-a3d2-44b1736727e2.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/69f25df5-9354-4387-a3d2-44b1736727e2.mp4',
      imagePath: '/assets/models/models-hero-horses-reference.webp',
      altText: 'Happy Horse 1.1 unified video model hero preview',
    },
    prompts: [
      {
        title: 'Native audio presenter',
        prompt:
          '16:9 studio product launch clip, a confident creator speaks directly to camera with natural lip-sync, warm key light, subtle camera push, clean room tone and soft launch music.',
        mode: 't2v',
      },
      {
        title: 'Animate campaign key art',
        prompt:
          'Bring the uploaded campaign still to life with a smooth dolly push, subtle fabric and hair motion, polished ad lighting, and synchronized ambience.',
        mode: 'i2v',
      },
      {
        title: 'Reference character consistency',
        prompt:
          'Use character1 and character2 from the reference images in a cinematic two-person product demo, consistent wardrobe, stable faces, natural synchronized dialogue.',
        mode: 'ref2v',
      },
    ],
    faqs: [
      {
        question: 'What Happy Horse 1.1 workflows are available in MaxVideoAI?',
        answer:
          'Happy Horse 1.1 is exposed as one current model with text-to-video, image-to-video, and reference-to-video generation.',
      },
      {
        question: 'Does Happy Horse 1.1 include lip-sync?',
        answer:
          'Yes. MaxVideoAI treats Happy Horse 1.1 as an audio-native model with synchronized native audio and lip-sync, without a separate lip-sync toggle.',
      },
      {
        question: 'Does Happy Horse 1.1 support video editing?',
        answer:
          'No official Happy Horse 1.1 video-edit endpoint is exposed on Fal for this launch. MaxVideoAI keeps Happy Horse 1.0 available as the legacy video-edit route.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 90,
      durationSeconds: 5,
      resolution: '1080p',
      label: '1080p native audio',
    },
    promptExample:
      '16:9 product launch presenter, natural lip-sync, warm studio light, slow camera push, synchronized room tone and subtle music, 5 seconds.',
    category: 'video',
  },
];
