import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const OMNI_DIRECTIVE_FIELD_VALUES: string[] = [];

const GEMINI_OMNI_FLASH_ENGINE: EngineCaps = {
  id: 'gemini-omni-flash',
  label: 'Gemini Omni Flash',
  provider: 'Google',
  version: 'Preview',
  status: 'early_access',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'retake'],
  maxDurationSec: 10,
  resolutions: ['720p'],
  aspectRatios: ['16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 20480,
    videoMaxDurationSec: 10,
    promptMaxChars: 12000,
    promptMaxCharsSource: 'observed',
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'retake'],
        requiredInModes: ['t2v', 'i2v', 'ref2v', 'v2v', 'retake'],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Source image',
        description: 'Use one image as the starting visual context for image-to-video generation.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'reference_images',
        type: 'image',
        label: 'Reference images',
        description: 'Add up to 10 images for Gemini Omni reference-to-video generation.',
        modes: ['ref2v'],
        requiredInModes: ['ref2v'],
        minCount: 1,
        maxCount: 10,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Use a short source clip for Gemini Omni video editing.',
        modes: ['v2v'],
        requiredInModes: ['v2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
        maxDurationSec: 10,
      },
      {
        id: 'previous_interaction_id',
        type: 'enum',
        label: 'Previous interaction',
        description: 'Stored Gemini Omni interaction id used for conversational refine runs.',
        modes: ['retake'],
        requiredInModes: ['retake'],
        values: OMNI_DIRECTIVE_FIELD_VALUES,
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4s', '6s', '8s', '10s'],
        default: '10s',
        modes: ['t2v', 'i2v', 'ref2v', 'v2v'],
        min: 4,
        max: 10,
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
        values: ['720p'],
        default: '720p',
      },
      {
        id: 'store_interaction',
        type: 'boolean',
        label: 'Store interaction',
        description: 'Keep the provider interaction id so the result can be refined in a later Omni run.',
        default: true,
      },
      {
        id: 'prompt_audio_direction',
        type: 'enum',
        label: 'Sound direction',
        description: 'Optional audio, ambience, music, speech, or SFX direction folded into the Omni prompt.',
        values: OMNI_DIRECTIVE_FIELD_VALUES,
      },
      {
        id: 'prompt_camera_direction',
        type: 'enum',
        label: 'Camera direction',
        description: 'Optional camera movement, framing, lens, or motion direction folded into the Omni prompt.',
        values: OMNI_DIRECTIVE_FIELD_VALUES,
      },
      {
        id: 'prompt_edit_instruction',
        type: 'enum',
        label: 'Edit instruction',
        description: 'Optional edit instruction for source-video and refine workflows.',
        modes: ['v2v', 'retake'],
        values: OMNI_DIRECTIVE_FIELD_VALUES,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'mp4', 'webm', 'mov', 'mpeg', 'mpg', 'wmv', '3gpp'],
      maxImageSizeMB: 20480,
      maxVideoDurationSec: 10,
      maxReferenceImages: 10,
      maxVideosPerPrompt: 3,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 10,
      byResolution: {
        '720p': 10,
      },
    },
    maxDurationSec: 10,
  },
  pricing: {
    unit: 'USD/s',
    base: 0.1,
    byResolution: {
      '720p': 0.1,
    },
    currency: 'USD',
    notes: 'Competitive MaxVideoAI preview estimate aligned near Fal.ai public Gemini Omni Flash rates.',
  },
  updatedAt: '2026-06-30T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google_vertex_omni',
    modelSlug: 'gemini-omni-flash-preview',
  },
  availability: 'limited',
  brandId: 'google-gemini',
};

export const GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'gemini-omni-flash',
    modelSlug: 'gemini-omni-flash',
    marketingName: 'Gemini Omni Flash',
    cardTitle: 'Gemini Omni Flash - conversational video generation',
    provider: 'Google',
    brandId: 'google-gemini',
    family: 'veo',
    versionLabel: 'Preview',
    availability: 'limited',
    logoPolicy: 'textOnly',
    billingNote: 'Google Vertex Omni direct preview route. Provider pricing is tracked separately until public SKU pricing is stable.',
    engine: GEMINI_OMNI_FLASH_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'gemini-omni-flash-preview',
        ui: {
          modes: ['t2v'],
          duration: { options: ['4s', '6s', '8s', '10s'], default: '10s' },
          resolution: ['720p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Generate a 720p video with native sound direction through Vertex Agent Platform Interactions.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'gemini-omni-flash-preview',
        ui: {
          modes: ['i2v'],
          duration: { options: ['4s', '6s', '8s', '10s'], default: '10s' },
          resolution: ['720p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
          maxUploadMB: 20480,
          notes: 'Animate one source image with optional sound and camera direction.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: 'gemini-omni-flash-preview',
        ui: {
          modes: ['ref2v'],
          duration: { options: ['4s', '6s', '8s', '10s'], default: '10s' },
          resolution: ['720p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
          maxUploadMB: 20480,
          notes: 'Use up to 10 reference images for reference-to-video prompts.',
        },
      },
      {
        mode: 'v2v',
        falModelId: 'gemini-omni-flash-preview',
        ui: {
          modes: ['v2v'],
          duration: { options: ['4s', '6s', '8s', '10s'], default: '10s' },
          resolution: ['720p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          maxUploadMB: 20480,
          notes: 'Edit a short source video with text, sound, and camera instructions.',
        },
      },
      {
        mode: 'retake',
        falModelId: 'gemini-omni-flash-preview',
        ui: {
          modes: ['retake'],
          resolution: ['720p'],
          resolutionLocked: true,
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Refine a stored Gemini Omni interaction by passing its previous interaction id.',
        },
      },
    ],
    defaultFalModelId: 'gemini-omni-flash-preview',
    seo: {
      title: 'Gemini Omni Flash Video Generator - Vertex AI Preview',
      description:
        'Use Gemini Omni Flash on MaxVideoAI for 720p text-to-video, image-to-video, reference-to-video, video editing, and conversational refine workflows through Google Vertex AI.',
      canonicalPath: '/models/gemini-omni-flash',
    },
    type: 'Text, image, references, video edit, conversational refine',
    seoText:
      'Gemini Omni Flash is Google’s preview multimodal video model for 720p clips up to 10 seconds, combining text, images, reference assets, source video, and sound direction in one Vertex Interactions workflow.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/a01fb42f-92d9-4312-b1a1-a721fae5400b.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/a01fb42f-92d9-4312-b1a1-a721fae5400b.mp4',
      imagePath: '/hero/veo-3-1-hero.jpg',
      altText: 'Demo video representing Gemini Omni Flash multimodal generation',
    },
    prompts: [
      {
        title: 'Conversational product reveal',
        prompt:
          'A compact espresso machine on a marble counter, morning light through the window, slow dolly in as steam rises and a subtle café ambience builds.',
        mode: 't2v',
      },
      {
        title: 'Reference-led campaign shot',
        prompt:
          'Use the reference images to preserve the product silhouette while creating a polished 10 second launch clip with clean camera motion and warm room tone.',
        mode: 'ref2v',
      },
      {
        title: 'Source clip refine',
        prompt:
          'Keep the original subject and edit the shot into a tighter commercial reveal with clearer product focus and softer background sound.',
        mode: 'v2v',
      },
    ],
    faqs: [
      {
        question: 'Is Gemini Omni Flash available through Vertex AI?',
        answer:
          'Yes. MaxVideoAI routes Gemini Omni Flash through Google Vertex Agent Platform Interactions using the gemini-omni-flash-preview model id when the direct route is enabled.',
      },
      {
        question: 'What resolution and duration does Gemini Omni Flash support?',
        answer:
          'Google documents 720p output, 16:9 and 9:16 aspect ratios, and video prompts up to 10 seconds for the current preview.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 100,
      durationSeconds: 10,
      resolution: '720p',
      label: 'Preview estimate',
    },
    surfaces: {
      modelPage: {
        indexable: true,
        includeInSitemap: true,
      },
      examples: {
        includeInFamilyResolver: false,
        includeInFamilyCopy: false,
      },
      compare: {
        suggestOpponents: ['veo-3-1', 'veo-3-1-fast', 'sora-2', 'seedance-2-0'],
        publishedPairs: ['veo-3-1', 'veo-3-1-fast', 'sora-2', 'seedance-2-0'],
        includeInHub: true,
      },
      app: {
        enabled: true,
        discoveryRank: 8,
        variantGroup: 'google-gemini-video',
        variantLabel: 'Omni Flash',
      },
      pricing: {
        includeInEstimator: true,
      },
    },
    promptExample:
      'A designer revises a sneaker ad on a studio monitor, then the scene becomes the final polished product clip, crisp foley, soft music bed, 720p vertical.',
  },
];
