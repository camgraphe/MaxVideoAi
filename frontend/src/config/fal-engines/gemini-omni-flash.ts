import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  GOOGLE_OMNI_OUTPUT_TOKENS_PER_SECOND,
  GOOGLE_OMNI_OUTPUT_USD_PER_MILLION_TOKENS,
} from '../../lib/google-omni-pricing';

const OMNI_DIRECTIVE_FIELD_VALUES: string[] = [];
const OMNI_MODEL_ID = 'gemini-omni-1.2-flash';
const OMNI_DURATIONS = ['3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s'];
const OMNI_RESOLUTIONS = ['360p', '720p', '1080p', '4k'] as const;
const OMNI_MODES = ['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'extend', 'retake'] as const;

function outputUsdPerSecond(resolution: keyof typeof GOOGLE_OMNI_OUTPUT_TOKENS_PER_SECOND): number {
  return GOOGLE_OMNI_OUTPUT_TOKENS_PER_SECOND[resolution] * GOOGLE_OMNI_OUTPUT_USD_PER_MILLION_TOKENS / 1_000_000;
}

const GEMINI_OMNI_FLASH_ENGINE: EngineCaps = {
  id: 'gemini-omni-flash',
  label: 'Gemini Omni Flash 1.2',
  provider: 'Google',
  version: '1.2',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: [...OMNI_MODES],
  maxDurationSec: 10,
  resolutions: [...OMNI_RESOLUTIONS],
  aspectRatios: ['16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 30,
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
        modes: [...OMNI_MODES],
        requiredInModes: [...OMNI_MODES],
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Source image',
        description: 'Use one image as the starting visual context for image-to-video generation.',
        modes: ['i2v', 'fl2v'],
        requiredInModes: ['i2v', 'fl2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Target ending frame for first/last-frame generation.',
        modes: ['fl2v'],
        requiredInModes: ['fl2v'],
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
        description: 'Use one owned source clip for Gemini Omni video editing or extension.',
        modes: ['v2v', 'extend'],
        requiredInModes: ['v2v', 'extend'],
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
        values: OMNI_DURATIONS,
        default: '10s',
        modes: [...OMNI_MODES],
        min: 3,
        max: 10,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16'],
        default: '16:9',
        modes: [...OMNI_MODES],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: [...OMNI_RESOLUTIONS],
        default: '720p',
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
        modes: ['v2v', 'extend', 'retake'],
        values: OMNI_DIRECTIVE_FIELD_VALUES,
      },
    ],
    constraints: {
      ownedAssetModes: ['fl2v', 'extend'],
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'mp4', 'webm', 'mov', 'mpeg', 'mpg', 'wmv', '3gpp'],
      maxImageSizeMB: 30,
      maxVideoDurationSec: 10,
      maxReferenceImages: 10,
      maxVideosPerPrompt: 3,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: outputUsdPerSecond('720p') * 100,
      byResolution: {
        '360p': outputUsdPerSecond('360p') * 100,
        '720p': outputUsdPerSecond('720p') * 100,
        '1080p': outputUsdPerSecond('1080p') * 100,
        '4k': outputUsdPerSecond('4k') * 100,
      },
    },
    maxDurationSec: 10,
  },
  pricing: {
    unit: 'USD/s',
    base: outputUsdPerSecond('720p'),
    byResolution: {
      '360p': outputUsdPerSecond('360p'),
      '720p': outputUsdPerSecond('720p'),
      '1080p': outputUsdPerSecond('1080p'),
      '4k': outputUsdPerSecond('4k'),
    },
    currency: 'USD',
    notes: 'Google Omni 1.2 output-token provider facts by resolution; customer pricing is applied canonically.',
  },
  updatedAt: '2026-11-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google_vertex_omni',
    modelSlug: OMNI_MODEL_ID,
  },
  availability: 'available',
  brandId: 'google-gemini',
};

export const GEMINI_OMNI_FLASH_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'gemini-omni-flash',
    marketingName: 'Gemini Omni Flash 1.2',
    cardTitle: 'Gemini Omni Flash 1.2 - conversational video generation',
    provider: 'Google',
    brandId: 'google-gemini',
    versionLabel: '1.2',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: 'Google Vertex Gemini Omni Flash 1.2 direct route. No Fal fallback is used.',
    engine: GEMINI_OMNI_FLASH_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: OMNI_MODEL_ID,
        ui: {
          modes: ['t2v'],
          duration: { options: OMNI_DURATIONS, default: '10s' },
          resolution: [...OMNI_RESOLUTIONS],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Generate video with native sound direction through Vertex Agent Platform Interactions.',
        },
      },
      {
        mode: 'i2v',
        falModelId: OMNI_MODEL_ID,
        ui: {
          modes: ['i2v'],
          duration: { options: OMNI_DURATIONS, default: '10s' },
          resolution: [...OMNI_RESOLUTIONS],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
          maxUploadMB: 30,
          notes: 'Animate one source image with optional sound and camera direction.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: OMNI_MODEL_ID,
        ui: {
          modes: ['ref2v'],
          duration: { options: OMNI_DURATIONS, default: '10s' },
          resolution: [...OMNI_RESOLUTIONS],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
          maxUploadMB: 30,
          notes: 'Use up to 10 reference images for reference-to-video prompts.',
        },
      },
      {
        mode: 'fl2v',
        falModelId: OMNI_MODEL_ID,
        ui: {
          modes: ['fl2v'],
          duration: { options: OMNI_DURATIONS, default: '10s' },
          resolution: [...OMNI_RESOLUTIONS],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
          maxUploadMB: 30,
          notes: 'Generate an ordered transition from a start image to an end image.',
        },
      },
      {
        mode: 'v2v',
        falModelId: OMNI_MODEL_ID,
        ui: {
          modes: ['v2v'],
          durationPolicy: 'source_video',
          duration: { options: OMNI_DURATIONS, default: '10s' },
          resolution: [...OMNI_RESOLUTIONS],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Edit a short source video with text, sound, and camera instructions.',
        },
      },
      {
        mode: 'extend',
        falModelId: OMNI_MODEL_ID,
        ui: {
          modes: ['extend'],
          duration: { options: OMNI_DURATIONS, default: '10s' },
          resolution: [...OMNI_RESOLUTIONS],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Continue one owned source video through Google Vertex Interactions.',
        },
      },
      {
        mode: 'retake',
        falModelId: OMNI_MODEL_ID,
        ui: {
          modes: ['retake'],
          duration: { options: OMNI_DURATIONS, default: '10s' },
          resolution: [...OMNI_RESOLUTIONS],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Refine a stored Gemini Omni interaction by passing its previous interaction id.',
        },
      },
    ],
    defaultFalModelId: OMNI_MODEL_ID,
    seo: {
      title: 'Gemini Omni Flash 1.2 Video Generator - Native Audio & Editing',
      description:
        'Use Gemini Omni Flash 1.2 on MaxVideoAI for text, image, reference, first/last-frame, editing, extension, and conversational video workflows.',
      canonicalPath: '/models/gemini-omni-flash',
    },
    type: 'Text, image, references, first/last frame, video edit, extension, conversational refine',
    seoText:
      'Gemini Omni Flash 1.2 is Google’s generally available multimodal video model for 360p through 4K clips, with 3 to 10 seconds currently offered on MaxVideoAI, combining text, images, reference assets, source video, and sound direction in one Vertex Interactions workflow.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/a01fb42f-92d9-4312-b1a1-a721fae5400b.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/a01fb42f-92d9-4312-b1a1-a721fae5400b.mp4',
      imagePath: '/hero/veo-3-1-hero.jpg',
      altText: 'Historical Gemini Omni Flash 1.1 video example',
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
          'Gemini Omni Flash 1.2 is generally available from Google and is the model used for new Omni renders on MaxVideoAI. Earlier examples retain their original 1.1 attribution.',
      },
      {
        question: 'What resolution and duration does Gemini Omni Flash support?',
        answer:
          'MaxVideoAI currently offers 360p, 720p, 1080p, and 4K output, 16:9 and 9:16 aspect ratios, and 3–10-second clips. Google also documents up to 15 seconds for generation and editing; 11–15-second output is not yet offered here. First/last-frame generation and extension are limited to 10 seconds.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 70,
      durationSeconds: 10,
      resolution: '720p',
      label: '1.2 estimate',
    },
    promptExample:
      'A designer revises a sneaker ad on a studio monitor, then the scene becomes the final polished product clip, crisp foley, soft music bed, 720p vertical.',
  },
];
