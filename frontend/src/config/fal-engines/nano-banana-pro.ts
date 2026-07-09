import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

const NANO_BANANA_PRO_ENGINE: EngineCaps = {
  id: 'nano-banana-pro',
  label: 'Nano Banana Pro',
  provider: 'Google',
  version: 'Pro',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2i', 'i2i'],
  maxDurationSec: 8,
  resolutions: ['1k', '2k', '4k'],
  aspectRatios: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
  fps: [1],
  audio: false,
  upscale4k: true,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    imageMaxMB: 25,
  },
  inputSchema: {
    required: [
      {
        id: 'prompt',
        type: 'text',
        label: 'Prompt',
        description: 'Describe the scene, subject, lighting, and any typography you need rendered.',
      },
    ],
    optional: [
      {
        id: 'num_images',
        type: 'number',
        label: 'Number of images',
        min: 1,
        max: 8,
        step: 1,
        default: 1,
        description: 'Batch studio-quality outputs (max 8 per run).',
      },
      {
        id: 'image_urls',
        type: 'image',
        label: 'Reference images',
        description: 'Upload reference stills when using edit or multi-image workflows.',
        modes: ['i2i'],
        requiredInModes: ['i2i'],
        minCount: 1,
        maxCount: 14,
        source: 'either',
      },
      {
        id: 'resolution',
        type: 'enum',
        label: 'Resolution',
        values: ['1k', '2k', '4k'],
        default: '2k',
        description: '1K/2K render at base price; 4K doubles the per-image cost.',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['t2i'],
        values: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: '1:1',
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        modes: ['i2i'],
        values: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
        default: 'auto',
      },
      {
        id: 'seed',
        type: 'number',
        label: 'Seed',
        description: 'Lock randomness to iterate on the same framing.',
      },
      {
        id: 'output_format',
        type: 'enum',
        label: 'Output format',
        values: ['jpeg', 'png', 'webp'],
        default: 'jpeg',
      },
      {
        id: 'enable_web_search',
        type: 'boolean',
        label: 'Enable web search',
        default: false,
        description: 'Ground factual or current visual details with Google Search.',
      },
      {
        id: 'thinking_level',
        type: 'enum',
        label: 'Thinking level',
        values: ['minimal', 'high'],
        default: 'high',
      },
    ],
    constraints: {
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      maxImageSizeMB: 25,
    },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 15,
      byResolution: {
        '1k': 15,
        '2k': 15,
        '4k': 30,
      },
    },
    flatCents: {
      default: 15,
      byResolution: {
        '1k': 15,
        '2k': 15,
        '4k': 30,
      },
    },
  },
  pricing: {
    unit: 'image',
    base: 0.15,
    currency: 'USD',
    notes: '$0.15 per 1K/2K image, $0.30 at 4K',
  },
  updatedAt: '2025-03-05T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'google_gemini_image',
    modelSlug: 'gemini-3-pro-image',
  },
  availability: 'available',
  brandId: 'google',
};


export const NANO_BANANA_PRO_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'nano-banana-pro',
    modelSlug: 'nano-banana-pro',
    marketingName: 'Nano Banana Pro',
    cardTitle: 'Nano Banana Pro',
    provider: 'Google',
    brandId: 'google',
    family: 'nano-banana',
    versionLabel: 'Pro',
    availability: 'available',
    logoPolicy: 'textOnly',
    billingNote: '$0.15 per 1K/2K image · $0.30 at 4K via managed queue',
    engine: NANO_BANANA_PRO_ENGINE,
    modes: [
      {
        mode: 't2i',
        falModelId: 'gemini-3-pro-image',
        ui: {
          modes: ['t2i'],
          aspectRatio: ['9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          resolution: ['1k', '2k', '4k'],
          notes: 'Studio-grade text rendering, character consistency, and optional 4K outputs.',
        },
      },
      {
        mode: 'i2i',
        falModelId: 'gemini-3-pro-image',
        ui: {
          modes: ['i2i'],
          aspectRatio: ['auto', '9:16', '16:9', '1:1', '4:5', '5:4', '4:3', '3:4', '3:2', '2:3', '21:9'],
          resolution: ['1k', '2k', '4k'],
          acceptsImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
          maxUploadMB: 25,
          notes: 'Upload references for object, character, and style control. Provider supports up to 14 sources.',
        },
      },
    ],
    defaultFalModelId: 'gemini-3-pro-image',
    seo: {
      title: 'Nano Banana Pro – 4K Text-to-Image & Editing | MaxVideoAI',
      description:
        'Generate studio-quality stills with Google’s Gemini 3-powered Nano Banana Pro. 1K, 2K, and 4K outputs, multi-image reference editing, and razor-sharp typography in MaxVideoAI.',
      canonicalPath: '/models/nano-banana-pro',
    },
    type: 'image',
    seoText:
      'Nano Banana Pro brings Google’s Gemini 3 Pro image stack into MaxVideoAI. Render 1K/2K explorations, upgrade to 4K finals, or upload references for precise edits—without leaving the workspace.',
    media: {
      videoUrl: 'https://media.maxvideoai.com/marketing/marketing/5977bed2-7e9a-489c-a437-3232c99bc078.png',
      imagePath: 'https://media.maxvideoai.com/marketing/marketing/5977bed2-7e9a-489c-a437-3232c99bc078.png',
      altText: 'Nano Banana Pro sample: video editor lit by blue and orange LEDs at triple monitors',
    },
    prompts: [
      {
        title: 'Editing suite portrait (16:9)',
        prompt:
          'Ultra-realistic cinematic portrait of a video creator in a modern editing studio at night with three ultra-wide monitors glowing with colorful timelines, blue/orange LED spill, rim light on the hair, shallow depth (85mm f/1.4), crisp eyes, natural skin and subtle film grain. 4K, no watermark or stray text.',
        mode: 't2i',
      },
      {
        title: 'Square avatar variant',
        prompt:
          'Reframe the same scene as a 1:1 avatar: keep the glowing monitors, dark background, and rim light while centering the creator’s face with clean bokeh and zero text artifacts.',
        mode: 't2i',
      },
    ],
    faqs: [
      {
        question: 'Does Nano Banana Pro support 4K renders?',
        answer:
          'Yes. Choose 4K in the composer for the sharpest output. Pricing doubles versus 1K/2K, so iterate at lower res before locking finals.',
      },
      {
        question: 'How many reference images can I use for edits?',
        answer:
          'The provider endpoint accepts up to 14 images via API. The MaxVideoAI composer lets you upload 1–4 refs to keep wardrobe, layout, or people consistent across edits.',
      },
      {
        question: 'Is Nano Banana Pro licensed for commercial projects?',
        answer:
          'Yes. Jobs run through a provider route with commercial-use rights, so you can export campaign stills, packaging renders, and product imagery for client deliverables.',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 15,
      label: 'Per 1K/2K image (4K doubles)',
    },
    promptExample:
      '2K cinematic portrait of a founder delivering a keynote on stage, accurate LED wall text “NEXT QUARTER IS NOW”, shallow depth of field.',
    category: 'image',
  },
];
