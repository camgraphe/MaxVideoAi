import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const SORA_2_ENGINE: EngineCaps = {
  id: 'sora-2',
  label: 'OpenAI Sora 2',
  provider: 'OpenAI',
  version: '2',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v'],
  maxDurationSec: 12,
  resolutions: ['720p'],
  aspectRatios: ['auto', '16:9', '9:16'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 50,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4', '8', '12'],
        default: '4',
        min: 4,
        max: 12,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['auto', '16:9', '9:16'],
        default: 'auto',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p'],
        default: '720p',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Image input',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
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
  },
  pricing: {
    unit: 'USD/s',
    base: 0.1,
    currency: 'USD',
    notes: '$0.10/s via managed provider routing (720p guidance)',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'openai',
    modelSlug: 'fal-ai/sora-2/text-to-video',
  },
  availability: 'available',
  brandId: 'openai',
};

const SORA_2_PRO_ENGINE: EngineCaps = {
  id: 'sora-2-pro',
  label: 'OpenAI Sora 2 Pro',
  provider: 'OpenAI',
  version: 'Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 12,
  resolutions: ['720p', '1080p', 'auto'],
  aspectRatios: ['16:9', '9:16', 'auto'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 75,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
      },
    ],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration',
        values: ['4', '8', '12'],
        default: '4',
        min: 4,
        max: 12,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9', '9:16', 'auto'],
        default: '16:9',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['720p', '1080p', 'auto'],
        default: '1080p',
      },
      {
        id: 'image_url',
        type: 'image',
        label: 'Image input',
        modes: ['i2v'],
        requiredInModes: ['i2v'],
        minCount: 1,
        maxCount: 1,
        source: 'either',
      },
    ],
    constraints: {
      supportedFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 30,
      byResolution: {
        '720p': 30,
        '1080p': 50,
        auto: 30,
      },
    },
  },
  pricing: {
    unit: 'USD/s',
    base: 0.3,
    currency: 'USD',
    notes: '$0.30/s at 720p, $0.50/s at 1080p',
  },
  updatedAt: '2025-02-14T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'openai',
    modelSlug: 'fal-ai/sora-2/text-to-video/pro',
  },
  availability: 'available',
  brandId: 'openai',
};


export const SORA_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'sora-2',
    marketingName: 'OpenAI Sora 2',
    cardTitle: 'Sora 2',
    provider: 'OpenAI',
    brandId: 'openai',
    versionLabel: '2',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: SORA_2_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/sora-2/text-to-video',
        ui: {
          modes: ['t2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['720p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: false,
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/sora-2/image-to-video',
        ui: {
          modes: ['i2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['720p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          acceptsImageFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
          audioToggle: false,
        },
      },
    ],
    defaultFalModelId: 'fal-ai/sora-2/text-to-video',
    seo: {
      title: 'Sora 2 – Generate AI Videos from Text or Image with Sound',
      description:
        'Create rich AI-generated videos from text or image prompts using Sora 2. Native voice-over, ambient effects, and motion sync via MaxVideoAI.',
      canonicalPath: '/models/sora-2',
    },
    type: 'Text + Image',
    seoText:
      'Generate videos from text or images using Sora 2 — now with voice-over, ambient sound, and smooth animation. Animate reference stills or craft full prompts with synced audio.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/15d61929-c1ef-4173-bb8c-75cb74b3ee19.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/15d61929-c1ef-4173-bb8c-75cb74b3ee19.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
      altText: 'Sora 2 demo: Director in creative studio beside AI monitors',
    },
    prompts: [
      {
        title: 'Storm-lit knowledge vault',
        prompt:
          "A glowing library in the middle of a stormy ocean, books flying above crashing waves, camera pans upward to reveal lightning streaks, soft orchestral music with a warm voice-over narrating, 'Knowledge survives everything.'",
        mode: 't2v',
      },
      {
        title: 'Remix from still',
        prompt: 'Animate the uploaded concept art into a slow motion hero shot, dramatic particles and volumetric lighting',
        mode: 'i2v',
      },
    ],
    faqs: [
      {
        question: 'Can I access Sora 2 from Europe?',
        answer: 'Yes. MaxVideoAI brokers access so European teams can render without waiting on an OpenAI invite.',
      },
      {
        question: 'Do Sora 2 renders include a watermark?',
        answer: 'No. Outputs are delivered clean, ready for editing and distribution.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 208,
      durationSeconds: 4,
      resolution: '720p',
      label: 'Audio on',
    },
    promptExample:
      "A glowing tree in the middle of the desert, soft piano in background, camera slowly zooms out, cinematic lighting, voice-over: 'This is where hope begins.'",
  },
  {
    id: 'sora-2-pro',
    marketingName: 'OpenAI Sora 2 Pro',
    cardTitle: 'Sora 2 Pro',
    provider: 'OpenAI',
    brandId: 'openai',
    versionLabel: 'Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    engine: SORA_2_PRO_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: 'fal-ai/sora-2/text-to-video/pro',
        ui: {
          modes: ['t2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['720p', '1080p'],
          aspectRatio: ['16:9', '9:16'],
          audioToggle: true,
          notes: 'Audio is enabled by default for lip-sync and ambience. Disable it if you only need silent motion.',
        },
      },
      {
        mode: 'i2v',
        falModelId: 'fal-ai/sora-2/image-to-video/pro',
        ui: {
          modes: ['i2v'],
          duration: { options: [4, 8, 12], default: 4 },
          resolution: ['auto', '720p', '1080p'],
          aspectRatio: ['auto', '16:9', '9:16'],
          acceptsImageFormats: ['png', 'jpeg', 'jpg', 'webp', 'gif', 'avif'],
          maxUploadMB: 75,
          audioToggle: true,
          notes: 'Upload a detailed still to preserve subject fidelity. Pro keeps dialogue in sync from the reference frame.',
        },
      },
    ],
    defaultFalModelId: 'fal-ai/sora-2/text-to-video/pro',
    seo: {
      title: 'Sora 2 Pro – Longer AI Videos with Audio & Enhanced Prompt Control',
      description:
        'Create longer, more immersive AI videos from text or images using Sora 2 Pro. Native voice, ambient sound, prompt chaining, and advanced control via MaxVideoAI.',
      canonicalPath: '/models/sora-2-pro',
    },
    type: 'Text + Image',
    seoText:
      'Generate longer AI videos with sound and scene control using Sora 2 Pro. Perfect for storytelling, explainers, and branded motion design—starting from image or text prompts.',
    demoUrl: 'https://media.maxvideoai.com/renders/marketing/15d61929-c1ef-4173-bb8c-75cb74b3ee19.mp4',
    media: {
      videoUrl: 'https://media.maxvideoai.com/renders/marketing/15d61929-c1ef-4173-bb8c-75cb74b3ee19.mp4',
      imagePath:
        'https://media.maxvideoai.com/renders/301cc489-d689-477f-94c4-0b051deda0bc/a5cbd8d3-33c7-47b5-8480-7f23aab89891-job_684c1b3d-2679-40d1-adb7-06151b3e8739.jpg',
      altText: 'Sora 2 Pro demo: director alongside AI preview screens',
    },
    prompts: [
      {
        title: 'Multi-scene legend opener',
        prompt:
          "Scene 1 → A medieval city under the stars, camera slowly pans above rooftops, lute music plays, voice-over: 'Peace reigned for a century.' → Scene 2 → A rider gallops across the plains at sunrise, orchestral swell, zoom-in to sword hilt glowing.",
        mode: 't2v',
        notes: 'Use multi-prompt chaining to stitch scenes together in a single render.',
      },
      {
        title: 'Torchlit discovery',
        prompt:
          "Scene 1 → Interior of a jungle temple at dusk, drums echo in the background, voice-over: 'Legends speak of a guardian.' → Scene 2 → Torchlit hallway, camera glides toward ancient glyphs as the music builds.",
        mode: 'i2v',
        notes: 'Start from a detailed concept still to keep glyphs and lighting consistent.',
      },
    ],
    faqs: [
      {
        question: 'Does Sora 2 Pro always output audio?',
        answer:
          'Audio is on by default for lip-sync and sound design, but you can toggle it off in the composer if you only need visuals.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 480,
      durationSeconds: 8,
      resolution: '1080p',
      label: 'Audio on',
    },
    promptExample:
      "Scene 1 → A jungle temple at dusk, drums in the background, voice-over: 'Legends speak of a guardian.' → Scene 2 → A torchlit hallway, camera zooms into mysterious glyphs.",
  },
];
