import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import {
  BYTEPLUS_SEEDANCE_2_5_ENDPOINTS,
  BYTEPLUS_SEEDANCE_2_5_MODEL_ID,
  buildSeedance25PricingDetails,
} from './launch-config';

const DURATION_OPTIONS = Array.from({ length: 27 }, (_, index) => index + 4);

const SEEDANCE_2_5_ENGINE: EngineCaps = {
  id: 'seedance-2-5',
  label: 'Seedance 2.5',
  provider: 'ByteDance',
  version: '2.5',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'ap-southeast-1',
  modes: ['t2v'],
  maxDurationSec: 30,
  resolutions: ['480p', '720p'],
  aspectRatios: ['16:9'],
  fps: [24],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {},
  inputSchema: {
    required: [{ id: 'prompt', type: 'text', label: 'Prompt' }],
    optional: [
      {
        id: 'duration',
        type: 'enum',
        label: 'Duration (seconds)',
        values: DURATION_OPTIONS.map(String),
        default: '4',
        min: 4,
        max: 30,
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
        values: ['480p', '720p'],
        default: '480p',
      },
    ],
  },
  pricingDetails: buildSeedance25PricingDetails(),
  pricing: {
    unit: 'USD/s',
    currency: 'USD',
    notes: 'Hidden administrator canary priced from Seedance 2.5 usage tokens.',
  },
  updatedAt: '2026-08-07T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'byteplus_modelark',
    modelSlug: BYTEPLUS_SEEDANCE_2_5_MODEL_ID,
  },
  availability: 'limited',
  brandId: 'bytedance',
};

export const SEEDANCE_2_5_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [
  {
    id: 'seedance-2-5',
    marketingName: 'Seedance 2.5',
    cardTitle: 'Seedance 2.5',
    provider: 'ByteDance',
    brandId: 'bytedance',
    versionLabel: '2.5',
    availability: 'limited',
    logoPolicy: 'textOnly',
    billingNote: 'Hidden administrator-only Seedance 2.5 canary.',
    engine: SEEDANCE_2_5_ENGINE,
    modes: [
      {
        mode: 't2v',
        falModelId: BYTEPLUS_SEEDANCE_2_5_ENDPOINTS.t2v,
        ui: {
          modes: ['t2v'],
          duration: { options: DURATION_OPTIONS, default: 4 },
          resolution: ['480p', '720p'],
          aspectRatio: ['16:9'],
          audioToggle: false,
          notes: 'Hidden canary: text-to-video, 4-30s, 480p/720p, 16:9, silent output.',
        },
      },
    ],
    defaultFalModelId: BYTEPLUS_SEEDANCE_2_5_ENDPOINTS.t2v,
    seo: {
      title: 'Seedance 2.5 — MaxVideoAI',
      description: 'Seedance 2.5 launch status on MaxVideoAI.',
      canonicalPath: '/models/seedance-2-5',
    },
    type: 'text',
    prompts: [],
    pricingHint: {
      currency: 'USD',
      amountCents: 0,
      label: 'Administrator-only live quote',
    },
    promptExample: 'A short cinematic scene with clear movement and no text overlays.',
  },
];
