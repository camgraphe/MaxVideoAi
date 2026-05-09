import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const WAN_2_6_ENGINE: EngineCaps = {
  id: 'wan-2-6',
  label: 'Wan 2.6 Text & Image to Video',
  provider: 'Wan',
  version: '2.6',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'r2v'],
  maxDurationSec: 15,
  resolutions: ['720p', '1080p'],
  aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
    videoMaxMB: 30,
    videoMaxDurationSec: 30,
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
      {
        id: 'video_urls',
        type: 'video',
        label: 'Reference videos',
        modes: ['r2v'],
        requiredInModes: ['r2v'],
        minCount: 1,
        maxCount: 3,
        source: 'upload',
      },
    ],
    optional: [
      {
        id: 'audio_url',
        type: 'text',
        label: 'Audio URL',
        description: 'Optional WAV/MP3 soundtrack (3-30s, <=15MB).',
        modes: ['t2v', 'i2v'],
      },
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: ['5', '10', '15'],
        default: '5',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', '1:1', '4:3', '3:4'],
        default: '16:9',
        modes: ['t2v', 'r2v'],
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p'],
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
        id: 'multi_shots',
        type: 'enum',
        label: 'Multi-shot',
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
      maxImageSizeMB: 25,
      maxVideoSizeMB: 30,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 10,
      byResolution: {
        '720p': 10,
        '1080p': 15,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.1,
    byResolution: {
      '720p': 0.1,
      '1080p': 0.15,
    },
    currency: 'USD',
    notes: '$0.50 per 5s @720p, $0.75 per 5s @1080p',
  },
  updatedAt: '2025-03-20T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'wan',
    modelSlug: 'wan/v2.6/text-to-video',
  },
  availability: 'available',
  brandId: 'wan',
};


export const WAN_2_6_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'wan-2-6',
    modelSlug: 'wan-2-6',
    marketingName: 'Wan 2.6 Text & Image to Video',
    cardTitle: 'Wan 2.6',
    provider: 'Wan',
    brandId: 'wan',
    family: 'wan',
    versionLabel: '2.6',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: WAN_2_6_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'wan/v2.6/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 10, 15], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4'],
          audioToggle: true,
          notes: 'Optional WAV/MP3 soundtrack (3–30s, <=15MB).',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'wan/v2.6/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [5, 10, 15], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: [],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          audioToggle: true,
          notes: 'Upload one still; aspect ratio follows the source image.',
        },
      },
      {
        mode: 'r2v',
        falModelId: 'wan/v2.6/reference-to-video',
        ui: {
          modes: ['r2v'],
          duration: { options: [5, 10], default: 5 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16', '1:1', '4:3', '3:4'],
          audioToggle: false,
          maxUploadMB: 30,
          notes: 'Upload 1–3 MP4/MOV references; tag them as @Video1/@Video2/@Video3.',
        },
      },
    ],
    defaultFalModelId: 'wan/v2.6/text-to-video',
    seo: {
      title: 'Wan 2.6 AI Video Generator (Text, Image & Reference) – MaxVideoAI',
      description:
        'Generate 5–15s cinematic clips with Wan 2.6 inside MaxVideoAI. Use multi-shot text prompts, animate a still image, or keep subject consistency with 1–3 reference videos. 720p/1080p, per-second pricing.',
      canonicalPath: '/models/wan-2-6',
    },
    type: 'textImage',
    seoText:
      'Wan 2.6 is a cinematic short-clip engine built for structured prompts and clean scene transitions. Switch between text, image, or reference video inputs to keep subjects consistent while iterating on short 5–15 second beats.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/f87943bb-4081-417e-bc8c-1b2392f03b4f.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/f87943bb-4081-417e-bc8c-1b2392f03b4f.mp4',
      imagePath: '/hero/wan-26.jpg',
      altText: 'Wan 2.6 demo render with cinematic motion and clean transitions.',
    },
    prompts: [
      {
        title: 'Vertical social mini-trailer',
        prompt:
          'Vertical 9:16, premium social ad. Shot 1 [0-3s] Macro of a product on a wet black surface, slow push-in, specular highlights. Shot 2 [3-8s] Whip pan reveal to a hand picking it up, soft rim light, bokeh city at night. Shot 3 [8-15s] Clean hero shot, subtle rotation, no text, no watermark.',
        mode: 't2v',
      },
      {
        title: 'Packshot motion from a still',
        prompt:
          'Continue from first frame. Slow dolly-in, gentle parallax, soft light sweep across the label, tiny dust particles, premium studio look, no text.',
        mode: 'i2v',
      },
      {
        title: 'Reference dance battle',
        prompt:
          'Dance battle between @Video1 and @Video2 in an empty museum hall. @Video1 starts center-left, @Video2 enters from right. Dynamic camera orbit, dramatic lighting.',
        mode: 'r2v',
        notes: 'Tag references with @Video1/@Video2/@Video3 in the prompt.',
      },
    ],
    faqs: [
      {
        question: 'Does Wan 2.6 support audio?',
        answer:
          'Audio URLs are optional for Text and Image modes. Reference mode does not support audio uploads.',
      },
      {
        question: 'How many reference videos can I upload?',
        answer:
          'Up to three MP4/MOV references. Tag them in the prompt as @Video1, @Video2, and @Video3.',
      },
      {
        question: 'What durations and resolutions are supported?',
        answer:
          'Text and Image modes run at 5, 10, or 15 seconds. Reference mode supports 5 or 10 seconds. Resolutions: 720p or 1080p.',
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
      'Cinematic 16:9 mini-trailer. Shot 1 [0-5s] wide drone glide over a cliff road. Shot 2 [5-10s] close tracking shot of wheels on gravel. Shot 3 [10-15s] slow pull-back reveal of the full landscape, film grain.',
  },
];
