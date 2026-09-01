import type { EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

export const GROK_IMAGINE_VIDEO_1_5_ENDPOINTS = {
  t2v: 'xai/grok-imagine-video/v1.5/text-to-video',
  i2v: 'xai/grok-imagine-video/v1.5/image-to-video',
  ref2v: 'xai/grok-imagine-video/v1.5/reference-to-video',
} as const;

const ASPECT_RATIOS = ['16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16'] as const;
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

const engine: EngineCaps = {
  id: 'grok-imagine-video-1-5',
  label: 'Grok Imagine Video 1.5',
  provider: 'xAI',
  version: '1.5',
  status: 'live',
  latencyTier: 'standard',
  queueDepth: 0,
  region: 'global',
  modes: ['t2v', 'i2v', 'ref2v'],
  maxDurationSec: 15,
  resolutions: ['480p', '720p', '1080p'],
  aspectRatios: [...ASPECT_RATIOS],
  fps: [],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: { promptMaxChars: 4096, promptMaxCharsSource: 'official' },
  inputSchema: {
    required: [
      {
        id: 'prompt', type: 'text', label: 'Prompt', modes: ['t2v', 'i2v', 'ref2v'],
        requiredInModes: ['t2v', 'i2v', 'ref2v'], description: 'Provider maximum: 4096 characters.',
      },
      {
        id: 'image_url', type: 'image', label: 'First-frame image', modes: ['i2v'], requiredInModes: ['i2v'],
        minCount: 1, maxCount: 1, source: 'either', acceptedFileExtensions: IMAGE_EXTENSIONS,
      },
      {
        id: 'reference_image_urls', type: 'image', label: 'Reference images', modes: ['ref2v'], requiredInModes: ['ref2v'],
        minCount: 1, maxCount: 7, source: 'either', slotLabelPattern: '<IMAGE_{n}>',
        description: 'Address references as <IMAGE_0>, <IMAGE_1>, and so on in the prompt.',
      },
    ],
    optional: [
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['t2v', 'ref2v'], values: [...ASPECT_RATIOS], default: '16:9' },
      { id: 'duration', type: 'number', label: 'Duration (seconds)', modes: ['t2v', 'i2v'], min: 1, max: 15, step: 1, default: 6 },
      { id: 'duration', type: 'number', label: 'Duration (seconds)', modes: ['ref2v'], min: 1, max: 15, step: 1, default: 8 },
      { id: 'resolution', type: 'enum', label: 'Resolution', modes: ['t2v', 'i2v'], values: ['480p', '720p', '1080p'], default: '720p' },
      { id: 'resolution', type: 'enum', label: 'Resolution', modes: ['ref2v'], values: ['480p', '720p'], default: '480p' },
    ],
    constraints: { supportedI2vImageFormats: IMAGE_EXTENSIONS },
  },
  pricingDetails: {
    currency: 'USD',
    perSecondCents: { default: 14, byResolution: { '480p': 8, '720p': 14, '1080p': 25 } },
    byMode: {
      ref2v: { perSecondCents: { byResolution: { '480p': 8, '720p': 14 } } },
    },
    referenceImages: { unitCents: 1, modes: ['ref2v'] },
  },
  pricing: {
    unit: 'USD/s', base: 0.14, byResolution: { '480p': 0.08, '720p': 0.14, '1080p': 0.25 }, currency: 'USD',
    notes: 'Base Fal cost per output second. Reference-to-video adds $0.01 per reference image; Task 5 owns exact count-aware charging.',
  },
  updatedAt: '2026-09-01T12:00:20Z',
  ttlSec: 600,
  providerMeta: { provider: 'xai' },
  availability: 'available',
  brandId: 'xai',
  brandAssetPolicy: { logoAllowed: false, textOnly: true, usageNotes: 'Use text-only xAI attribution until approved brand assets are present.' },
  modeCaps: {
    t2v: {
      modes: ['t2v'], duration: { min: 1, default: 6 }, resolution: ['480p', '720p', '1080p'],
      aspectRatio: [...ASPECT_RATIOS], audioToggle: false,
      notes: 'Generated audio is native and fixed; Fal publishes no fps value.',
    },
    i2v: {
      modes: ['i2v'], duration: { min: 1, default: 6 }, resolution: ['480p', '720p', '1080p'],
      acceptsImageFormats: IMAGE_EXTENSIONS, audioToggle: false,
      notes: 'One first-frame image. This endpoint exposes no aspect-ratio control or fps value.',
    },
    ref2v: {
      modes: ['ref2v'], duration: { min: 1, default: 8 }, resolution: ['480p', '720p'],
      aspectRatio: [...ASPECT_RATIOS], audioToggle: false,
      notes: 'Requires 1–7 reference images. Reference audio is included by Fal but no audio input field is exposed.',
    },
  },
};

export const GROK_IMAGINE_VIDEO_1_5_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: 'grok-imagine-video-1-5', marketingName: 'Grok Imagine Video 1.5', cardTitle: 'Grok Imagine Video 1.5',
  provider: 'xAI', brandId: 'xai', versionLabel: '1.5', availability: 'available', logoPolicy: 'textOnly',
  billingNote: 'Fal bills $0.08/$0.14/$0.25 per output second at 480p/720p/1080p; reference mode adds $0.01 per reference image and requires Task 5 count-aware pricing.',
  engine,
  modes: [
    { mode: 't2v', falModelId: GROK_IMAGINE_VIDEO_1_5_ENDPOINTS.t2v, ui: engine.modeCaps!.t2v! },
    { mode: 'i2v', falModelId: GROK_IMAGINE_VIDEO_1_5_ENDPOINTS.i2v, ui: engine.modeCaps!.i2v! },
    { mode: 'ref2v', falModelId: GROK_IMAGINE_VIDEO_1_5_ENDPOINTS.ref2v, ui: engine.modeCaps!.ref2v! },
  ],
  defaultFalModelId: GROK_IMAGINE_VIDEO_1_5_ENDPOINTS.t2v,
  seo: { title: 'Grok Imagine Video 1.5 | MaxVideoAI', description: 'Generate Grok Imagine Video 1.5 clips from text, an image, or up to seven image references.', canonicalPath: '/models/grok-imagine-video-1-5' },
  prompts: [
    { title: 'Cinematic prompt', prompt: 'A cinematic night drive through a rain-soaked city, realistic reflections and natural sound.', mode: 't2v' },
    { title: 'Animate an image', prompt: 'Bring the uploaded frame to life with subtle subject motion and a smooth camera push.', mode: 'i2v' },
    { title: 'Reference composition', prompt: 'Place <IMAGE_0> and <IMAGE_1> together in a cohesive cinematic scene.', mode: 'ref2v' },
  ],
}];
