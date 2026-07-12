import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  BYTEPLUS_SEEDANCE_2_FAST_CAPS_ID,
  BYTEPLUS_SEEDANCE_2_FAST_MODEL_ID,
  SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS,
  buildSeedance2PricingDetails,
} from './launch-config';

const SEEDANCE_2_0_FAST_BYTEPLUS_ENGINE: EngineCaps = {
  id: 'seedance-2-0-fast-byteplus',
  label: 'Dreamina Seedance 2.0 Fast Direct',
  provider: 'ByteDance',
  version: '2.0',
  variant: 'Fast',
  isLab: true,
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'ap-southeast-1',
  modes: ['t2v'],
  maxDurationSec: 15,
  resolutions: ['720p'],
  aspectRatios: ['16:9'],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    promptMaxChars: 4000,
    promptMaxCharsSource: 'observed',
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
        label: 'Duration (seconds)',
        values: ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
        default: '5',
        min: 5,
        max: 15,
      },
      {
        id: 'aspect_ratio',
        type: 'enum',
        label: 'Aspect ratio',
        values: ['16:9'],
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
        id: 'generate_audio',
        type: 'boolean',
        label: 'Audio',
        default: true,
      },
    ],
  },
  pricingDetails: buildSeedance2PricingDetails(SEEDANCE_2_NORMALIZED_UNIT_PRICE_USD_PER_1K_TOKENS.fast),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes: 'Admin-only direct Seedance route. Public Seedance pricing remains unchanged while actual provider cost is recorded separately.',
  },
  updatedAt: '2026-05-01T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'byteplus_modelark',
    modelSlug: BYTEPLUS_SEEDANCE_2_FAST_MODEL_ID,
  },
  availability: 'limited',
  brandId: 'bytedance',
};


export const SEEDANCE_2_BYTEPLUS_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-2-0-fast-byteplus',
    marketingName: 'Dreamina Seedance 2.0 Fast Direct',
    cardTitle: 'Dreamina Seedance 2.0 Fast Direct',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '2.0 Fast Direct',
    availability: 'limited',
    logoPolicy: 'textOnly',
    billingNote: 'Admin-only direct Seedance test route. Public Seedance pricing remains unchanged.',
    engine: SEEDANCE_2_0_FAST_BYTEPLUS_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: BYTEPLUS_SEEDANCE_2_FAST_CAPS_ID,
        ui: {
          modes: ['t2v'],
          duration: { options: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 },
          resolution: ['720p'],
          aspectRatio: ['16:9'],
          audioToggle: false,
          notes: 'Admin-only direct Seedance route: 720p, 16:9, 5-15s, silent output.',
        },
      },
    ],
    defaultFalModelId: BYTEPLUS_SEEDANCE_2_FAST_CAPS_ID,
    seo: {
      title: 'Dreamina Seedance 2.0 Fast Direct Admin Test',
      description: 'Hidden admin-only direct Dreamina Seedance 2.0 Fast route.',
      canonicalPath: '/models/seedance-2-0-fast-byteplus',
    },
    type: 'text',
    prompts: [
      {
        title: 'Direct Seedance smoke test',
        prompt: 'A clean cinematic five second product video, simple motion, no text overlays, 16:9.',
        mode: 't2v',
      },
    ],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Admin-only live quote',
    },
    promptExample: 'A clean cinematic five second product video, simple motion, no text overlays, 16:9.',
  },
];
