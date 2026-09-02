import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import { createFlux3CommonOptionalFields, FLUX_3_ASPECT_RATIOS, FLUX_3_AUTO_DURATIONS, FLUX_3_EXPLICIT_DURATIONS } from './flux-3-shared';

export const FLUX_3_DRAFT_ENDPOINTS = {
  t2v: 'blackforestlabs/flux-3/text-to-video/draft',
  i2v: 'blackforestlabs/flux-3/image-to-video/draft',
  fl2v: 'blackforestlabs/flux-3/first-last-frame-to-video/draft',
  extend: 'blackforestlabs/flux-3/extend-video/draft',
} as const;

const DRAFT_CAPS: NonNullable<EngineCaps['modeCaps']> = {
  t2v: { modes: ['t2v'], duration: { options: FLUX_3_AUTO_DURATIONS, default: 'auto' }, resolution: ['720p'], resolutionLocked: true, aspectRatio: [...FLUX_3_ASPECT_RATIOS], audioToggle: true, notes: '720p-only draft generation returning draft_cache; no fps value is published.' },
  i2v: { modes: ['i2v'], duration: { options: FLUX_3_AUTO_DURATIONS, default: 'auto' }, resolution: ['720p'], resolutionLocked: true, aspectRatio: [...FLUX_3_ASPECT_RATIOS], audioToggle: true, notes: 'Opening image accepts a URL or data URI. Returns draft_cache.' },
  fl2v: { modes: ['fl2v'], duration: { options: FLUX_3_EXPLICIT_DURATIONS, default: '5' }, resolution: ['720p'], resolutionLocked: true, aspectRatio: [...FLUX_3_ASPECT_RATIOS], audioToggle: true, notes: 'Exactly two URL/data-URI frames. Returns draft_cache.' },
  extend: { modes: ['extend'], duration: { options: FLUX_3_AUTO_DURATIONS, default: 'auto' }, resolution: ['720p'], resolutionLocked: true, aspectRatio: [...FLUX_3_ASPECT_RATIOS], maxUploadMB: 50, audioToggle: true, notes: 'URL/data-URI MP4 up to 50 MiB. Returns draft_cache.' },
};

const engine: EngineCaps = {
  id: 'flux-3-draft',
  label: 'FLUX 3 Draft',
  provider: 'Black Forest Labs',
  version: '3',
  variant: 'Draft',
  status: 'live',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'fl2v', 'extend'],
  maxDurationSec: 20,
  resolutions: ['720p'],
  // The current canonical AspectRatio union lacks provider value 2:1.
  // inputSchema/modeCaps preserve it verbatim; Task 4 owns typed request projection.
  aspectRatios: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {},
  inputSchema: {
    required: [
      { id: 'prompt', type: 'text', label: 'Prompt', modes: ['t2v', 'i2v', 'fl2v', 'extend'], requiredInModes: ['t2v', 'i2v', 'fl2v', 'extend'] },
      { id: 'image_url', type: 'image', label: 'Opening image', modes: ['i2v'], requiredInModes: ['i2v'], minCount: 1, maxCount: 1, source: 'either', description: 'Provider accepts a URL or data URI.' },
      { id: 'start_image_url', type: 'image', label: 'Start image', modes: ['fl2v'], requiredInModes: ['fl2v'], minCount: 1, maxCount: 1, source: 'either', description: 'Provider accepts a URL or data URI.' },
      { id: 'end_image_url', type: 'image', label: 'End image', modes: ['fl2v'], requiredInModes: ['fl2v'], minCount: 1, maxCount: 1, source: 'either', description: 'Provider accepts a URL or data URI.' },
      {
        id: 'video_url', type: 'video', label: 'Source video', modes: ['extend'], requiredInModes: ['extend'], minCount: 1, maxCount: 1,
        source: 'either', maxSizeMB: 50, acceptedMimeTypes: ['video/mp4'], acceptedFileExtensions: ['mp4'],
        description: 'Provider accepts a URL or data URI for an MP4 up to 50 MiB.',
      },
    ],
    optional: createFlux3CommonOptionalFields(),
    constraints: { draftResolution: '720p', resolutionFieldExposed: false, returnsDraftCache: true, extendVideoMaxMiB: 50 },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: { default: 6, byResolution: { '720p': 6 } },
    byMode: {
      extend: { perSecondCents: { byResolution: { '720p': 12 } } },
    },
  },
  pricing: {
    unit: 'USD/s', base: 0.06, byResolution: { '720p': 0.06 }, currency: 'USD',
    notes: 'Draft text/image/frame generation costs $0.06/s. Draft extend costs $0.12/s; Task 5 owns exact mode-aware charging.',
  },
  updatedAt: '2026-09-01T12:00:20Z',
  ttlSec: 600,
  providerMeta: { provider: 'blackforestlabs' },
  availability: 'available',
  brandId: 'black-forest-labs',
  brandAssetPolicy: { logoAllowed: false, textOnly: true, usageNotes: 'Use text-only Black Forest Labs attribution until approved brand assets are present.' },
  modeCaps: DRAFT_CAPS,
};

export const FLUX_3_DRAFT_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: 'flux-3-draft', marketingName: 'FLUX 3 Draft', cardTitle: 'FLUX 3 Draft Video', provider: 'Black Forest Labs', brandId: 'black-forest-labs',
  versionLabel: '3 Draft', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Draft generation bills $0.06 per 720p output second; draft extend bills $0.12. Task 5 supplies exact mode-aware pricing.',
  engine,
  modes: [
    { mode: 't2v', falModelId: FLUX_3_DRAFT_ENDPOINTS.t2v, ui: DRAFT_CAPS.t2v! },
    { mode: 'i2v', falModelId: FLUX_3_DRAFT_ENDPOINTS.i2v, ui: DRAFT_CAPS.i2v! },
    { mode: 'fl2v', falModelId: FLUX_3_DRAFT_ENDPOINTS.fl2v, ui: DRAFT_CAPS.fl2v! },
    { mode: 'extend', falModelId: FLUX_3_DRAFT_ENDPOINTS.extend, ui: DRAFT_CAPS.extend! },
  ],
  defaultFalModelId: FLUX_3_DRAFT_ENDPOINTS.t2v,
  seo: { title: 'FLUX 3 Draft AI Video | MaxVideoAI', description: 'Generate fast 720p FLUX 3 drafts from text, images, first/last frames, or source video.', canonicalPath: '/models/flux-3-draft' },
  prompts: [
    { title: 'Draft a concept', prompt: 'A fast cinematic concept pass with clear motion, composition, and synchronized sound.', mode: 't2v' },
    { title: 'Draft image motion', prompt: 'Test a natural camera move and subject animation from the opening image.', mode: 'i2v' },
    { title: 'Draft a transition', prompt: 'Explore a coherent transition between the supplied first and last frames.', mode: 'fl2v' },
    { title: 'Draft an extension', prompt: 'Continue the source scene while preserving its visual and audio direction.', mode: 'extend' },
  ],
}];
