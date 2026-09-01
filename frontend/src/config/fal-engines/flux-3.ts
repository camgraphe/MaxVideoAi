import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';
import { createFlux3CommonOptionalFields, FLUX_3_ASPECT_RATIOS, FLUX_3_AUTO_DURATIONS, FLUX_3_EXPLICIT_DURATIONS } from './flux-3-shared';

export const FLUX_3_ENDPOINTS = {
  t2v: 'blackforestlabs/flux-3/text-to-video',
  i2v: 'blackforestlabs/flux-3/image-to-video',
  fl2v: 'blackforestlabs/flux-3/first-last-frame-to-video',
  extend: 'blackforestlabs/flux-3/extend-video',
} as const;

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const STANDARD_MODE_CAPS: NonNullable<EngineCaps['modeCaps']> = {
  t2v: {
    modes: ['t2v'], duration: { options: FLUX_3_AUTO_DURATIONS, default: 'auto' }, resolution: ['720p', '1080p'],
    aspectRatio: [...FLUX_3_ASPECT_RATIOS], audioToggle: true, notes: 'Fal publishes no fps value.',
  },
  i2v: {
    modes: ['i2v'], duration: { options: FLUX_3_AUTO_DURATIONS, default: 'auto' }, resolution: ['720p', '1080p'],
    aspectRatio: [...FLUX_3_ASPECT_RATIOS], acceptsImageFormats: IMAGE_EXTENSIONS, audioToggle: true, notes: 'One PNG, JPEG, or WebP opening image; no upload-size limit is published.',
  },
  fl2v: {
    modes: ['fl2v'], duration: { options: FLUX_3_EXPLICIT_DURATIONS, default: '5' }, resolution: ['720p', '1080p'],
    aspectRatio: [...FLUX_3_ASPECT_RATIOS], acceptsImageFormats: IMAGE_EXTENSIONS, audioToggle: true, notes: 'Requires exactly one start image and one end image.',
  },
  extend: {
    modes: ['extend'], duration: { options: FLUX_3_AUTO_DURATIONS, default: 'auto' }, resolution: ['720p', '1080p'],
    aspectRatio: [...FLUX_3_ASPECT_RATIOS], maxUploadMB: 50, audioToggle: true, notes: 'Requires an MP4 source smaller than 50 MB and shorter than 15 seconds.',
  },
};

const engine: EngineCaps = {
  id: 'flux-3',
  label: 'FLUX 3',
  provider: 'Black Forest Labs',
  version: '3',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'fl2v', 'extend'],
  maxDurationSec: 20,
  resolutions: ['720p', '1080p'],
  // The current canonical AspectRatio union lacks provider value 2:1.
  // inputSchema/modeCaps preserve it verbatim; Task 4 owns typed request projection.
  aspectRatios: ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
  fps: [],
  audio: true,
  upscale4k: false,
  extend: true,
  motionControls: false,
  keyframes: true,
  params: {},
  inputLimits: {},
  inputSchema: {
    required: [
      { id: 'prompt', type: 'text', label: 'Prompt', modes: ['t2v', 'i2v', 'fl2v', 'extend'], requiredInModes: ['t2v', 'i2v', 'fl2v', 'extend'] },
      { id: 'image_url', type: 'image', label: 'Opening image', modes: ['i2v'], requiredInModes: ['i2v'], minCount: 1, maxCount: 1, source: 'either', acceptedFileExtensions: IMAGE_EXTENSIONS },
      { id: 'start_image_url', type: 'image', label: 'Start image', modes: ['fl2v'], requiredInModes: ['fl2v'], minCount: 1, maxCount: 1, source: 'either', acceptedFileExtensions: IMAGE_EXTENSIONS },
      { id: 'end_image_url', type: 'image', label: 'End image', modes: ['fl2v'], requiredInModes: ['fl2v'], minCount: 1, maxCount: 1, source: 'either', acceptedFileExtensions: IMAGE_EXTENSIONS },
      {
        id: 'video_url', type: 'video', label: 'Source video', modes: ['extend'], requiredInModes: ['extend'], minCount: 1, maxCount: 1,
        source: 'either', maxSizeMB: 50, acceptedMimeTypes: ['video/mp4'], acceptedFileExtensions: ['mp4'],
        description: 'Provider requires MP4 smaller than 50 MB and shorter than 15 seconds.',
      },
    ],
    optional: [
      ...createFlux3CommonOptionalFields(),
      { id: 'resolution', type: 'enum', label: 'Resolution', modes: ['t2v', 'i2v', 'fl2v', 'extend'], values: ['720p', '1080p'], default: '720p' },
    ],
    constraints: {
      standardImageFormats: IMAGE_EXTENSIONS,
      extendVideoFormat: 'mp4',
      extendVideoSizeExclusiveMaxMB: 50,
      extendVideoDurationExclusiveMaxSec: 15,
    },
  },
  pricingDetails: { currency: 'USD', perSecondCents: { default: 17, byResolution: { '720p': 17, '1080p': 29 } } },
  pricing: {
    unit: 'USD/s', base: 0.17, byResolution: { '720p': 0.17, '1080p': 0.29 }, currency: 'USD',
    notes: 'Text/image/frame generation costs $0.17/s at 720p or $0.29/s at 1080p. Extend costs $0.41/$0.53; Task 5 owns exact mode-aware charging.',
  },
  updatedAt: '2026-09-01T12:00:20Z',
  ttlSec: 600,
  providerMeta: { provider: 'blackforestlabs' },
  availability: 'available',
  brandId: 'black-forest-labs',
  brandAssetPolicy: { logoAllowed: false, textOnly: true, usageNotes: 'Use text-only Black Forest Labs attribution until approved brand assets are present.' },
  modeCaps: STANDARD_MODE_CAPS,
};

export const FLUX_3_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: 'flux-3', marketingName: 'FLUX 3', cardTitle: 'FLUX 3 Video', provider: 'Black Forest Labs', brandId: 'black-forest-labs',
  versionLabel: '3', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Generation bills $0.17/$0.29 per output second at 720p/1080p; extend bills $0.41/$0.53. Task 5 supplies exact mode-aware pricing.',
  engine,
  modes: [
    { mode: 't2v', falModelId: FLUX_3_ENDPOINTS.t2v, ui: STANDARD_MODE_CAPS.t2v! },
    { mode: 'i2v', falModelId: FLUX_3_ENDPOINTS.i2v, ui: STANDARD_MODE_CAPS.i2v! },
    { mode: 'fl2v', falModelId: FLUX_3_ENDPOINTS.fl2v, ui: STANDARD_MODE_CAPS.fl2v! },
    { mode: 'extend', falModelId: FLUX_3_ENDPOINTS.extend, ui: STANDARD_MODE_CAPS.extend! },
  ],
  defaultFalModelId: FLUX_3_ENDPOINTS.t2v,
  seo: { title: 'FLUX 3 AI Video | MaxVideoAI', description: 'Generate FLUX 3 video from text, images, first/last frames, or extend an MP4.', canonicalPath: '/models/flux-3' },
  prompts: [
    { title: 'Cinematic generation', prompt: 'A cinematic macro sequence with detailed motion, atmospheric sound, and controlled lighting.', mode: 't2v' },
    { title: 'Animate an opening frame', prompt: 'Continue naturally from the opening frame with realistic motion and a smooth camera move.', mode: 'i2v' },
    { title: 'Connect two frames', prompt: 'Create a coherent transition between the supplied first and last frames.', mode: 'fl2v' },
    { title: 'Extend a scene', prompt: 'Continue the source scene while preserving visual style, action, and sound continuity.', mode: 'extend' },
  ],
}];
