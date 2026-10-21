import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import { FLUX_3_ASPECT_RATIOS, FLUX_3_EXPLICIT_DURATIONS } from './flux-3-shared';

export const FLUX_3_MAX_ID = 'flux-3-max' as const;
export const FLUX_3_MAX_MODES = ['t2v', 'i2v', 'fl2v', 'ref2v'] as const;
export const FLUX_3_MAX_ENDPOINTS = {
  t2v: 'blackforestlabs/flux-3-max/text-to-video',
  i2v: 'blackforestlabs/flux-3-max/image-to-video',
  fl2v: 'blackforestlabs/flux-3-max/image-to-video',
  ref2v: 'blackforestlabs/flux-3-max/keyframes-to-video',
} as const;
export const FLUX_3_MAX_RESOLUTIONS = ['720p', '1080p'] as const;
export const FLUX_3_MAX_REASONING_LEVELS = ['low', 'high'] as const;
export const FLUX_3_MAX_SEED_RANGE = { min: 0, max: 2147483647 } as const;
const modes = [...FLUX_3_MAX_MODES];
const imageUpload = {
  acceptedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  acceptedFileExtensions: ['png', 'jpg', 'jpeg', 'webp'],
  source: 'either' as const, minCount: 1, maxCount: 1,
};

const modeCaps: NonNullable<EngineCaps['modeCaps']> = Object.fromEntries(modes.map((mode) => [mode, {
  modes: [mode], duration: { options: FLUX_3_EXPLICIT_DURATIONS, default: '5' },
  resolution: [...FLUX_3_MAX_RESOLUTIONS], aspectRatio: [...FLUX_3_ASPECT_RATIOS], audioToggle: true,
  notes: '5–20 whole seconds. 1080p output is upscaled. Fal publishes no FPS control.',
}]));

export const FLUX_3_MAX_ENGINE: EngineCaps = {
  id: FLUX_3_MAX_ID, label: 'FLUX 3 Max', provider: 'Black Forest Labs', version: '3 Max',
  status: 'live', latencyTier: 'standard', queueDepth: 0, region: 'global',
  modes, maxDurationSec: 20, resolutions: [...FLUX_3_MAX_RESOLUTIONS],
  aspectRatios: [...FLUX_3_ASPECT_RATIOS], fps: [], audio: true,
  upscale4k: false, extend: false, motionControls: false,
  keyframes: true, params: {}, inputLimits: {},
  inputSchema: {
    required: [
      { id: 'prompt', type: 'text', label: 'Prompt', modes, requiredInModes: modes },
      { id: 'image_url', type: 'image', label: 'Opening image', modes: ['i2v'], requiredInModes: ['i2v'], ...imageUpload },
      { id: 'start_image_url', type: 'image', label: 'Start image', modes: ['fl2v'], requiredInModes: ['fl2v'], ...imageUpload },
      { id: 'end_image_url', type: 'image', label: 'End image', modes: ['i2v', 'fl2v'], requiredInModes: ['fl2v'], ...imageUpload },
      { id: 'reference_image_urls', type: 'image', label: 'Keyframe images', modes: ['ref2v'], requiredInModes: ['ref2v'], ...imageUpload, maxCount: 10, description: '1–10 ordered images, each paired with its frame position.' },
      { id: 'keyframe_indexes', type: 'text', label: 'Keyframe positions', modes: ['ref2v'], requiredInModes: ['ref2v'], description: 'Comma-separated unique frame indexes in reference order, from 0 through duration × 24 inclusive.' },
    ],
    optional: [
      { id: 'duration', type: 'enum', label: 'Duration (seconds)', modes, values: FLUX_3_EXPLICIT_DURATIONS, default: '5' },
      { id: 'resolution', type: 'enum', label: 'Resolution', modes, values: [...FLUX_3_MAX_RESOLUTIONS], default: '720p', description: '1080p output is upscaled.' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes, values: [...FLUX_3_ASPECT_RATIOS], default: 'auto' },
      { id: 'generate_audio', type: 'boolean', label: 'Generate audio', modes, default: true },
      { id: 'reasoning_level', type: 'enum', label: 'Reasoning level', modes, values: [...FLUX_3_MAX_REASONING_LEVELS], default: 'high' },
      { id: 'seed', type: 'number', label: 'Seed', modes, step: 1, ...FLUX_3_MAX_SEED_RANGE },
    ],
  },
  pricingDetails: {
    currency: 'USD', perSecondCents: { default: 17, byResolution: { '720p': 17, '1080p': 29 } }, maxDurationSec: 20,
  },
  pricing: {
    unit: 'USD/s', base: 0.17, byResolution: { '720p': 0.17, '1080p': 0.29 }, currency: 'USD',
    notes: 'Normal Fal list rates, excluding the temporary launch promotion. Customer pricing is supplied by the canonical quote.',
  },
  updatedAt: '2026-10-20T00:00:00Z', ttlSec: 600,
  providerMeta: { provider: 'blackforestlabs', modelSlug: FLUX_3_MAX_ENDPOINTS.t2v },
  availability: 'available', brandId: 'black-forest-labs',
  brandAssetPolicy: { logoAllowed: false, textOnly: true, usageNotes: 'Use text-only Black Forest Labs attribution until approved brand assets are present.' },
  modeCaps,
};

export const FLUX_3_MAX_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: FLUX_3_MAX_ID, marketingName: 'FLUX 3 Max', cardTitle: 'FLUX 3 Max', provider: 'Black Forest Labs',
  brandId: 'black-forest-labs', versionLabel: '3 Max', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Review the current quote for your selected duration and resolution before generation.',
  engine: FLUX_3_MAX_ENGINE,
  modes: modes.map((mode) => ({ mode, falModelId: FLUX_3_MAX_ENDPOINTS[mode], ui: modeCaps[mode]! })),
  defaultFalModelId: FLUX_3_MAX_ENDPOINTS.t2v,
  seo: { title: 'FLUX 3 Max AI Video | MaxVideoAI', description: 'Create 5–20 second FLUX 3 Max videos from a prompt, an opening image, first and last frames, or up to 10 keyframes, with optional generated audio.', canonicalPath: '/models/flux-3-max' },
  prompts: [
    { title: 'Describe a scene', prompt: 'A glass bird unfolds its wings in a sunlit greenhouse, with gentle wing sounds and a slow camera move.', mode: 't2v' },
    { title: 'Animate an image', prompt: 'Continue naturally from the supplied opening image with a slow camera move and realistic motion.', mode: 'i2v' },
    { title: 'Connect two frames', prompt: 'Create a smooth, coherent transition between the supplied first and last frames.', mode: 'fl2v' },
  ],
}];
