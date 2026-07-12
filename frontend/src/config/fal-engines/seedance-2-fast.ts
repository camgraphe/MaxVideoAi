import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  SEEDANCE_2_ENDPOINTS,
  SEEDANCE_2_LAUNCH_CONFIG,
  SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS,
  buildSeedance2PricingDetails,
} from './launch-config';

const SEEDANCE_2_0_FAST_ENGINE: EngineCaps = {
  id: 'seedance-2-0-fast',
  label: 'Seedance 2.0 Fast',
  provider: 'ByteDance',
  version: '2.0',
  variant: 'Fast',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
  maxDurationSec: 15,
  resolutions: ['480p', '720p'],
  aspectRatios: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: true,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 30,
    videoMaxMB: 50,
    audioMaxMB: 15,
    videoMaxDurationSec: 15,
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
        description: 'Upload a reference image, or create one first with Seedream for better composition and consistency.',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    optional: [
      {
        id: 'end_image_url',
        type: 'image',
        label: 'End image',
        description: 'Optional last frame for start-to-end transitions in image-to-video.',
        modes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['auto', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        default: 'auto',
        min: 4,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
        default: 'auto',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['480p', '720p'],
        default: '720p',
      },
      {
        id: 'generate_audio',
        type: 'boolean',
        label: 'Audio',
        default: true,
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images (up to 9)',
        description: 'Optional visual references for draft continuity checks or Video Edit. Create clean references with Seedream first for better composition and consistency.',
        modes: ['ref2v', 'v2v'],
        minCount: 1,
        maxCount: 9,
        source: 'either',
      },
      {
        id: 'video_url',
        type: 'video',
        label: 'Source video',
        description: 'Required source video for video-to-video editing.',
        modes: ['v2v'],
        requiredInModes: ['v2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
      {
        id: 'video_urls',
        type: 'video',
        label: 'Reference video clips (up to 3)',
        description: 'Optional pacing or motion references for draft-speed ref2v runs. Supports up to 3 videos, 2 to 15 seconds combined, under 50 MB total.',
        minCount: 0,
        maxCount: 3,
        minDurationSec: 2,
        maxDurationSec: 15,
        modes: ['ref2v'],
        source: 'either',
      },
      {
        id: 'extension_source_videos',
        type: 'video',
        label: 'Source clips to extend (up to 3)',
        description: 'Add one source clip to extend forward or backward, or 2-3 clips to stitch a transition.',
        modes: ['extend'],
        requiredInModes: ['extend'],
        minCount: 1,
        maxCount: 3,
        source: 'either',
        slotLabelPattern: 'Source clip {n}',
      },
      {
        id: 'audio_urls',
        type: 'audio',
        label: 'Reference audio clips (up to 3)',
        description: 'Optional soundtrack or rhythm references for reference or video-edit runs. Supports up to 3 files, max 15 MB each, and requires at least one image or video reference if audio is used.',
        minCount: 0,
        maxCount: 3,
        modes: ['ref2v', 'v2v'],
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mp3', 'wav'],
      maxImageSizeMB: 30,
      maxVideoSizeMB: 50,
      maxAudioSizeMB: 15,
    },
  },
  pricingDetails: buildSeedance2PricingDetails(SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS.fast),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes: 'Seedance 2 Fast is billed from output tokens. MaxVideoAI adds its margin and rounds up to the next cent before showing the live quote.',
  },
  updatedAt: '2026-04-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'bytedance',
    modelSlug: SEEDANCE_2_ENDPOINTS.fast.t2v,
  },
  availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
  brandId: 'bytedance',
};


export const SEEDANCE_2_FAST_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-2-0-fast',
    marketingName: 'Seedance 2.0 Fast',
    cardTitle: 'Seedance 2.0 Fast',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '2.0 Fast',
    availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
    logoPolicy: 'textOnly',
    billingNote: 'Seedance 2 Fast uses token-based provider pricing. Generate shows the active route, applies the MaxVideoAI margin, and rounds the quote up to the next cent before each run.',
    engine: SEEDANCE_2_0_FAST_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          audioToggle: true,
          notes: 'Draft-speed Seedance 2 route with 4-15s or auto, 480p/720p, and the same audio toggle.',
        },
      },
      {
        mode: 'i2v',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.i2v,
        ui: {
          modes: ['i2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Start image plus optional end image, 4-15s or auto, 480p/720p, and draft-speed iteration.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.ref2v,
        ui: {
          modes: ['ref2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Prompt-only is allowed, or add up to 9 images, 3 videos, and 3 audio files before moving winners into standard Seedance 2.0.',
        },
      },
      {
        mode: 'v2v',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.v2v,
        ui: {
          modes: ['v2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 50,
          audioToggle: true,
          notes: 'Video edit uses a source clip plus optional image and audio references for fast 4-15s Seedance 2.0 edits.',
        },
      },
      {
        mode: 'extend',
        falModelId: SEEDANCE_2_ENDPOINTS.fast.extend,
        ui: {
          modes: ['extend'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          maxUploadMB: 50,
          audioToggle: true,
          notes: 'Extend continues a source clip forward or backward, or stitches up to 3 clips into one coherent Fast Seedance 2.0 video.',
        },
      },
    ],
    defaultFalModelId: SEEDANCE_2_ENDPOINTS.fast.t2v,
    seo: {
      title: 'Seedance 2.0 Fast — ByteDance Draft-Speed Video and Reference Model',
      description:
        'Seedance 2.0 Fast is the draft-speed Seedance 2 tier on MaxVideoAI for faster iteration, shorter feedback loops, 480p/720p output, and quick text, image, and reference-based comparisons.',
      canonicalPath: '/models/seedance-2-0-fast',
    },
    type: 'textImage',
    seoText:
      'Seedance 2.0 Fast is the draft-speed Seedance 2.0 variant for quicker iteration, auto or 4-15 second runs, 480p/720p output, optional end-frame image-to-video, reference-to-video, video edit, and extend comparison rounds.',
    media: {
      videoUrl: 'https://media.maxvideoai.com/marketing/marketing/15eafeab-582a-4126-80c3-879fdb7740aa.webm',
      imagePath: '/hero/seedance-2-0.jpg',
      altText: 'Seedance 2.0 Fast demo frame',
    },
    demoUrl: 'https://media.maxvideoai.com/marketing/marketing/15eafeab-582a-4126-80c3-879fdb7740aa.webm',
    prompts: [
      {
        title: 'Fast draft concept',
        prompt:
          'Draft-speed cinematic social ad, one hero action beat, fast camera move, native ambience, designed for quick iteration rather than final polish.',
        mode: 't2v',
      },
      {
        title: 'Fast still-to-motion test',
        prompt:
          'Animate one approved still into a short motion draft with clean subject continuity, restrained camera motion, and simple synced ambience.',
        mode: 'i2v',
      },
      {
        title: 'Fast reference continuity check',
        prompt:
          'Use four reference stills to test one character, one outfit, and one set, then compare framing, timing, and continuity before the standard-tier final.',
        mode: 'ref2v',
      },
      {
        title: 'Fast video edit test',
        prompt:
          'Use one source clip as the base video, keep the scene structure readable, and modify one visible action for a quick draft-speed edit.',
        mode: 'v2v',
      },
      {
        title: 'Fast extend test',
        prompt:
          'Extend the source clip by one clear follow-up beat with matching camera direction, lighting, and native ambience.',
        mode: 'extend',
      },
    ],
    faqs: [
      {
        question: 'When should I use Seedance 2.0 Fast?',
        answer:
          'Use Seedance 2.0 Fast for faster ideation, comparison runs, and short draft passes before you commit to the standard Seedance 2.0 tier.',
      },
      {
        question: 'What should I compare Seedance 2.0 Fast against first?',
        answer:
          'Start with Veo 3.1 Fast and LTX 2.3 Fast to judge draft speed, motion behavior, and how closely the output matches the Seedance look you want.',
      },
      {
        question: 'Can I use image-to-video and reference-to-video with Seedance 2.0 Fast?',
        answer:
          'Yes. Fast supports image-to-video with an optional end frame and reference-to-video with image, video, and audio references when you want to validate timing before scaling up.',
      },
      {
        question: 'Can Seedance 2.0 Fast edit or extend a video?',
        answer:
          'Yes. The MaxVideoAI Seedance 2.0 Fast route supports video edit and extend workflows for quick source-clip tests before a higher-polish final.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Live quote in Generate',
    },
    promptExample:
      'Fast draft pass for a three-beat product story, simple camera language, audio on, built for iteration before pushing finals through standard Seedance 2.0.',
  },
];
