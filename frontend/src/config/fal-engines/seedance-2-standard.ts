import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  SEEDANCE_2_ENDPOINTS,
  SEEDANCE_2_LAUNCH_CONFIG,
  SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS,
  buildSeedance2PricingDetails,
} from './launch-config';

const SEEDANCE_2_0_ENGINE: EngineCaps = {
  id: 'seedance-2-0',
  label: 'Seedance 2.0',
  provider: 'ByteDance',
  version: '2.0',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v', 'v2v', 'extend'],
  maxDurationSec: 15,
  resolutions: ['480p', '720p', '1080p', '4k'],
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
        values: ['480p', '720p', '1080p', '4k'],
        default: '720p',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images (up to 9)',
        description: 'Optional visual references for Reference to Video or Video Edit. Create clean references with Seedream first for better composition and consistency.',
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
        description: 'Optional motion or pacing references for ref2v. Supports up to 3 videos, 2 to 15 seconds combined, under 50 MB total.',
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
        description: 'Optional soundtrack, dialogue, or rhythm references for reference or video-edit runs. Supports up to 3 files, max 15 MB each, and requires at least one image or video reference if audio is used.',
        minCount: 0,
        maxCount: 3,
        modes: ['ref2v', 'v2v'],
        source: 'either',
      },
      {
        id: 'generate_audio',
        type: 'boolean',
        label: 'Audio',
        default: true,
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'mp3', 'wav'],
      maxImageSizeMB: 30,
      maxVideoSizeMB: 50,
      maxAudioSizeMB: 15,
    },
  },
  pricingDetails: buildSeedance2PricingDetails(SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS.standard, {
    unitPriceUsdPer1kTokensByResolution: {
      '1080p': SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS.standard1080p,
      '4k': SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS.standard4k,
    },
  }),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes: 'Seedance 2 is billed from output tokens. MaxVideoAI adds its margin and rounds up to the next cent before showing the live quote.',
  },
  updatedAt: '2026-04-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'bytedance',
    modelSlug: SEEDANCE_2_ENDPOINTS.standard.t2v,
  },
  availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
  brandId: 'bytedance',
};


export const SEEDANCE_2_STANDARD_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-2-0',
    marketingName: 'Seedance 2.0',
    cardTitle: 'Seedance 2.0',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '2.0',
    availability: SEEDANCE_2_LAUNCH_CONFIG.availability,
    logoPolicy: 'textOnly',
    billingNote: 'Seedance 2 uses token-based provider pricing. Generate shows the active route, applies the MaxVideoAI margin, and rounds the quote up to the next cent before each run.',
    engine: SEEDANCE_2_0_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p', '1080p', '4k'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          audioToggle: true,
          notes: '4-15s or auto, 480p/720p/1080p/4K, native audio on or off, with the wider Seedance 2 camera ratio set.',
        },
      },
      {
        mode: 'i2v',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.i2v,
        ui: {
          modes: ['i2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p', '1080p', '4k'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Start image plus optional end image, 4-15s or auto, 480p/720p/1080p/4K, with audio on or off.',
        },
      },
      {
        mode: 'ref2v',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.ref2v,
        ui: {
          modes: ['ref2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p', '1080p', '4k'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 30,
          audioToggle: true,
          notes: 'Prompt-only is allowed, or add up to 9 images, 3 videos, and 3 audio files with 12 total references max.',
        },
      },
      {
        mode: 'v2v',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.v2v,
        ui: {
          modes: ['v2v'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p', '1080p', '4k'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 50,
          audioToggle: true,
          notes: 'Video edit uses a source clip plus optional image and audio references for 4-15s Standard Seedance 2.0 edits.',
        },
      },
      {
        mode: 'extend',
        falModelId: SEEDANCE_2_ENDPOINTS.standard.extend,
        ui: {
          modes: ['extend'],
          duration: { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' },
          resolution: ['480p', '720p', '1080p', '4k'],
          aspectRatio: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
          maxUploadMB: 50,
          audioToggle: true,
          notes: 'Extend continues a source clip forward or backward, or stitches up to 3 clips into one coherent Standard Seedance 2.0 video.',
        },
      },
    ],
    defaultFalModelId: SEEDANCE_2_ENDPOINTS.standard.t2v,
    seo: {
      title: 'Seedance 2.0 — ByteDance AI Video with Native Audio and References',
      description:
        'Seedance 2.0 by ByteDance: cinematic AI video with native audio, realistic physics, director-level camera control, 480p/720p/1080p/4K output, and text, image, and reference workflows.',
      canonicalPath: '/models/seedance-2-0',
    },
    type: 'textImage',
    seoText:
      'Seedance 2.0 supports text-to-video, image-to-video with optional end frame, reference-to-video, video edit, and extend workflows with 480p/720p/1080p/4K output, auto or 4-15 second durations, multimodal references, and native audio generation.',
    media: {
      videoUrl: 'https://media.maxvideoai.com/marketing/marketing/15eafeab-582a-4126-80c3-879fdb7740aa.webm',
      imagePath: '/hero/seedance-2-0.jpg',
      altText: 'Seedance 2.0 demo frame showing a cinematic homecoming scene',
    },
    demoUrl: 'https://media.maxvideoai.com/marketing/marketing/15eafeab-582a-4126-80c3-879fdb7740aa.webm',
    prompts: [
      {
        title: 'Action chase test',
        prompt:
          'Cinematic rooftop chase at dusk, three shots with natural cuts, handheld tracking then crane reveal, synchronized footsteps and city ambience, 15 seconds total.',
        mode: 't2v',
      },
      {
        title: 'Storyboard reference run',
        prompt:
          'Use storyboard references to keep character wardrobe and location continuity across a 3-shot sequence, with dual-channel ambient audio and one dialogue line.',
        mode: 'i2v',
      },
      {
        title: 'Reference continuity pass',
        prompt:
          'Use six reference stills to keep one hero outfit and one city location consistent across a three-beat sequence, then add a soft ambience bed and one impact cue.',
        mode: 'ref2v',
      },
      {
        title: 'Video edit pass',
        prompt:
          'Use one source clip as the base video, preserve the main scene and camera continuity, then modify one visible action with clean native ambience.',
        mode: 'v2v',
      },
      {
        title: 'Extend pass',
        prompt:
          'Continue the source clip forward with matching lighting, motion direction, and sound so the extension feels like the next beat of the same scene.',
        mode: 'extend',
      },
    ],
    faqs: [
      {
        question: 'What is Seedance 2.0 best for?',
        answer:
          'Use Seedance 2.0 for cinematic multi-shot timelines, stronger motion realism, and native audio-led outputs.',
      },
      {
        question: 'Which Seedance route family should I use first?',
        answer:
          'Start with text-to-video for prompt-led ideation, use image-to-video when you need a start frame or an optional end frame, and move to reference-to-video when you want image, video, or audio guidance.',
      },
      {
        question: 'Does Seedance 2.0 support reference-to-video on MaxVideoAI?',
        answer:
          'Yes. Seedance 2.0 exposes a dedicated reference-to-video route with up to 9 images, up to 3 reference videos, and up to 3 reference audio files, with 12 total files across the run.',
      },
      {
        question: 'Does Seedance 2.0 support video editing and extend?',
        answer:
          'Yes. The MaxVideoAI Seedance 2.0 route supports video edit and extend workflows alongside text, image, and reference-to-video generation.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Live quote in Generate',
    },
    promptExample:
      'Three-shot cinematic sequence, 15 seconds total, director-style camera language, realistic physics, synchronized dialogue and ambience, 16:9.',
  },
];
