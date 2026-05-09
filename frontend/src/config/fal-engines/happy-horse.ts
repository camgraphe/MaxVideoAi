import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  HAPPY_HORSE_ASPECT_RATIOS,
  HAPPY_HORSE_DURATION_OPTIONS,
  HAPPY_HORSE_ENDPOINTS,
} from './launch-config';

const HAPPY_HORSE_1_0_ENGINE: EngineCaps = {
  id: 'happy-horse-1-0',
  label: 'Happy Horse 1.0',
  provider: 'Alibaba',
  version: '1.0',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v', 'v2v'],
  maxDurationSec: 15,
  resolutions: ['720p', '1080p'],
  aspectRatios: [...HAPPY_HORSE_ASPECT_RATIOS],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 10,
    videoMaxMB: 100,
    videoMaxDurationSec: 60,
    videoCodecs: ['mp4', 'mov'],
    promptMaxChars: 2500,
    promptMaxCharsSource: 'official',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'ref2v', 'v2v'],
        requiredInModes: ['t2v', 'ref2v', 'v2v'],
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
      {
        id: 'image_urls',
        type: 'image',
        label: 'R2V reference images (1-9)',
        description:
          'Reference subjects with character1, character2, and up to character9 in the prompt. Requires 1-9 JPEG, PNG, or WEBP references.',
        modes: ['ref2v'],
        requiredInModes: ['ref2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
        slotLabelPattern: 'character{n}',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Source MP4 or MOV clip to edit. Output preserves source aspect ratio and is capped to the first 15 seconds.',
        modes: ['v2v'],
        requiredInModes: ['v2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
        minDurationSec: 3,
        maxDurationSec: 60,
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
        values: [...HAPPY_HORSE_ASPECT_RATIOS],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        modes: ['t2v', 'i2v', 'ref2v', 'v2v'],
        values: ['720p', '1080p'],
        default: '1080p',
      },
      {
        id: 'reference_image_urls',
        type: 'image',
        label: 'Edit reference images (up to 5)',
        description: 'Optional visual references for the video edit. Refer to them as @Image1, @Image2, and up to @Image5.',
        modes: ['v2v'],
        minCount: 0,
        maxCount: 5,
        source: 'either',
        slotLabelPattern: '@Image{n}',
      },
      {
        id: 'audio_setting',
        type: 'enum',
        label: 'Audio handling',
        description: 'Use auto for native audio regeneration, or origin to preserve the source audio.',
        modes: ['v2v'],
        values: ['auto', 'origin'],
        default: 'auto',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Optional random seed for reproducible Happy Horse generations. Accepted range: 0-2147483647.',
        modes: ['t2v', 'i2v', 'ref2v', 'v2v'],
        min: 0,
        max: 2147483647,
        step: 1,
      },
      {
        id: 'enable_safety_checker',
        type: 'boolean',
        label: 'Safety checker',
        description: 'Enable provider input and output moderation.',
        modes: ['t2v', 'i2v', 'ref2v', 'v2v'],
        default: true,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp', 'mp4', 'mov'],
      maxImageSizeMB: 10,
      maxVideoSizeMB: 100,
      minImageSidePx: 300,
      minReferenceImageSidePx: 400,
      imageAspectRatioRange: '1:2.5 to 2.5:1',
      videoAspectRatioRange: '1:2.5 to 2.5:1',
      sourceVideoMaxOutputSec: 15,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 14,
      byResolution: {
        '720p': 14,
        '1080p': 28,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.14,
    byResolution: {
      '720p': 0.14,
      '1080p': 0.28,
    },
    currency: 'USD',
    notes:
      'Provider cost: $0.14/s for 720p and $0.28/s for 1080p text, image, and R2V runs. Video edit is billed at $0.28/s for 720p and $0.56/s for 1080p.',
  },
  updatedAt: '2026-04-28T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'alibaba',
    modelSlug: HAPPY_HORSE_ENDPOINTS.t2v,
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
      aspectRatio: [...HAPPY_HORSE_ASPECT_RATIOS],
      audioToggle: false,
      notes: 'Text-to-video with native synchronized audio and multilingual lip-sync.',
    },
    i2v: {
      modes: ['i2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      acceptsImageFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
      maxUploadMB: 10,
      audioToggle: false,
      notes: 'Animate one start image with optional prompt guidance. Aspect ratio is inferred from the source image.',
    },
    ref2v: {
      modes: ['ref2v'],
      duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
      resolution: ['720p', '1080p'],
      aspectRatio: [...HAPPY_HORSE_ASPECT_RATIOS],
      acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxUploadMB: 10,
      audioToggle: false,
      notes: 'R2V reference-image workflow with 1-9 image references and character1..character9 prompt anchors.',
    },
    v2v: {
      modes: ['v2v'],
      resolution: ['720p', '1080p'],
      maxUploadMB: 100,
      audioToggle: false,
      notes: 'Video edit from one source clip, with optional reference images and auto/origin audio handling.',
    },
  },
};


export const HAPPY_HORSE_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'happy-horse-1-0',
    modelSlug: 'happy-horse-1-0',
    marketingName: 'Happy Horse 1.0',
    cardTitle: 'Happy Horse 1.0 - Unified audio-native video model',
    provider: 'Alibaba',
    brandId: 'alibaba',
    family: 'happy-horse',
    versionLabel: '1.0',
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
        suggestOpponents: ['seedance-2-0', 'veo-3-1', 'kling-3-pro', 'sora-2-pro'],
        publishedPairs: ['seedance-2-0', 'veo-3-1', 'kling-3-pro', 'sora-2-pro'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 8,
        variantGroup: 'happy-horse',
        variantLabel: '1.0',
      },
      pricing: {
        includeInEstimator: true,
        featuredScenario: 'unified native-audio video',
      },
    },
    engine: HAPPY_HORSE_1_0_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: HAPPY_HORSE_ENDPOINTS.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: [...HAPPY_HORSE_ASPECT_RATIOS],
          audioToggle: false,
          notes: 'Prompt-only generation with synchronized native audio and multilingual lip-sync.',
        },
      },
      {
        mode: 'i2v',
        falModelId: HAPPY_HORSE_ENDPOINTS.i2v,
        ui: {
          modes: ['i2v'],
          duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
          resolution: ['720p', '1080p'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'bmp', 'webp'],
          maxUploadMB: 10,
          audioToggle: false,
          notes: 'Animate a first-frame image. The output aspect ratio follows the uploaded image.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: HAPPY_HORSE_ENDPOINTS.ref2v,
        ui: {
          modes: ['ref2v'],
          duration: { options: [...HAPPY_HORSE_DURATION_OPTIONS], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: [...HAPPY_HORSE_ASPECT_RATIOS],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 10,
          audioToggle: false,
          notes: 'R2V reference-image mode. Use character1..character9 in the prompt to bind uploaded references.',
        },
      },
      {
        mode: 'v2v',
        falModelId: HAPPY_HORSE_ENDPOINTS.v2v,
        ui: {
          modes: ['v2v'],
          resolution: ['720p', '1080p'],
          maxUploadMB: 100,
          audioToggle: false,
          notes: 'Edit one source video with text instructions, optional reference images, and auto/origin audio handling.',
        },
      },
    ],
    defaultFalModelId: HAPPY_HORSE_ENDPOINTS.t2v,
    seo: {
      title: 'Happy Horse 1.0 - Unified AI Video Model with Native Audio | MaxVideoAI',
      description:
        'Generate Happy Horse 1.0 videos on MaxVideoAI with text, image, R2V reference, and video-edit workflows plus native synchronized audio and lip-sync.',
      canonicalPath: '/models/happy-horse-1-0',
    },
    type: 'textImageReferenceVideoEdit',
    seoText:
      'Happy Horse 1.0 combines text-to-video, image-to-video, reference-image R2V, and video-edit workflows in one Alibaba model card, with native audio and lip-sync treated as part of the generation rather than a separate post step.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/69f25df5-9354-4387-a3d2-44b1736727e2.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/69f25df5-9354-4387-a3d2-44b1736727e2.mp4',
      imagePath: '/assets/models/models-hero-horses-reference.webp',
      altText: 'Happy Horse 1.0 unified video model hero preview',
    },
    prompts: [
      {
        title: 'Native audio spokesperson',
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
        title: 'R2V character consistency',
        prompt:
          'Use character1 and character2 from the reference images in a cinematic two-person product demo, consistent wardrobe, stable faces, natural synchronized dialogue.',
        mode: 'ref2v',
      },
      {
        title: 'Video edit with reference style',
        prompt:
          'Edit the uploaded clip into a premium launch scene: preserve the person and pacing, refresh the lighting to warm studio gold, keep audio natural with synchronized speech.',
        mode: 'v2v',
      },
    ],
    faqs: [
      {
        question: 'What Happy Horse workflows are available in MaxVideoAI?',
        answer:
          'Happy Horse 1.0 is exposed as one unified model with text-to-video, image-to-video, R2V reference-image generation, and video-to-video editing.',
      },
      {
        question: 'Does Happy Horse include lip-sync?',
        answer:
          'Yes. MaxVideoAI treats Happy Horse as an audio-native model with synchronized native audio and lip-sync, without a separate lip-sync toggle.',
      },
      {
        question: 'How is Happy Horse video edit priced?',
        answer:
          'Text, image, and R2V runs use the standard per-second rates by resolution. Video edit is billed at the combined input/output rate, so it is double the standard rate for the selected resolution.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 140,
      durationSeconds: 5,
      resolution: '1080p',
      label: '1080p native audio',
    },
    promptExample:
      '16:9 product launch spokesperson, natural lip-sync, warm studio light, slow camera push, synchronized room tone and subtle music, 5 seconds.',
    category: 'video',
  },
];
