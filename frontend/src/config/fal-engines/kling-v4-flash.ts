import type { EngineCaps, EngineInputField } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

// fal public OpenAPI verified 2026-11-05. Access and publication are separate gates.
export const KLING_V4_FLASH_ID = 'kling-v4-flash' as const;
export const KLING_V4_FLASH_PROMPT_MAX_CHARS = 26000;
export const KLING_V4_FLASH_ENDPOINTS = {
  t2v: 'kling/v4/flash/text-to-video',
  i2v: 'kling/v4/flash/image-to-video',
  ref2v: 'kling/v4/flash/reference-to-video',
} as const;
export const KLING_V4_FLASH_DURATIONS = Array.from({ length: 18 }, (_, i) => String(i + 3));
export const KLING_V4_FLASH_ASPECT_RATIOS = ['16:9', '9:16', '1:1', '21:9'] as const;
// No provider-wide mixed cap is documented. Launch conservatively admits 15
// actual originals, including subject views; this is our envelope, not a fal limit.
export const KLING_V4_FLASH_REFERENCE_LIMIT = 15;
const modes = ['t2v', 'i2v', 'ref2v'] as const;
const imageInput: Partial<EngineInputField> = {
  source: 'either', minCount: 0, maxCount: 1, maxSizeMB: 30,
  imageAspectRatio: { min: 0.4, max: 2.5 },
};
const modeCaps: NonNullable<EngineCaps['modeCaps']> = Object.fromEntries(modes.map(mode => [mode, {
  modes: [mode], duration: { options: KLING_V4_FLASH_DURATIONS, default: '5' }, resolution: ['720p'],
  aspectRatio: mode === 'i2v' ? [] : [...(mode === 'ref2v' ? ['auto'] : []), ...KLING_V4_FLASH_ASPECT_RATIOS],
  audioToggle: false, notes: '3–20 whole seconds at 720p. Describe native audio in the prompt. No FPS or audio switch.',
}]));

export const KLING_V4_FLASH_ENGINE: EngineCaps = {
  id: KLING_V4_FLASH_ID, label: 'Kling 4.0 Flash', provider: 'Kling by Kuaishou', version: '4.0 Flash',
  status: 'live', availability: 'available', latencyTier: 'fast', queueDepth: 0, region: 'global',
  modes: [...modes], maxDurationSec: 20, resolutions: ['720p'], aspectRatios: [...KLING_V4_FLASH_ASPECT_RATIOS], fps: [], audio: true,
  upscale4k: false, extend: false, motionControls: false, keyframes: false, params: {},
  inputLimits: { promptMaxChars: KLING_V4_FLASH_PROMPT_MAX_CHARS, promptMaxCharsSource: 'official', imageMaxMB: 30, videoMaxMB: 300, videoMaxDurationSec: 20.05 },
  inputSchema: {
    required: [
      { id: 'prompt', type: 'text', label: 'Prompt', modes: [...modes], requiredInModes: ['t2v', 'ref2v'], description: 'Optional when animating an opening image.' },
      { ...imageInput, id: 'image_url', engineParam: 'start_image_url', type: 'image', label: 'Opening image', modes: ['i2v', 'ref2v'], requiredInModes: ['i2v'] },
    ],
    optional: [
      { ...imageInput, id: 'image_urls', type: 'image', label: 'Reference images', modes: ['ref2v'], maxCount: 10, description: 'The opening image also counts toward the ten-image limit.' },
      { id: 'video_urls', type: 'video', label: 'Reference videos', modes: ['ref2v'], source: 'either', minCount: 0, maxCount: 5, maxSizeMB: 300, minDurationSec: 3, maxDurationSec: 20.05, description: 'Reference videos and subject videos share a 20-second total limit. Subject videos are 3–8 seconds each.' },
      { id: 'duration', type: 'enum', label: 'Duration (seconds)', modes: [...modes], values: KLING_V4_FLASH_DURATIONS, default: '5', min: 3, max: 20 },
      { id: 'resolution', type: 'enum', label: 'Resolution', modes: [...modes], values: ['720p'], default: '720p' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['t2v'], values: [...KLING_V4_FLASH_ASPECT_RATIOS], default: '16:9' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['ref2v'], values: ['auto', ...KLING_V4_FLASH_ASPECT_RATIOS], default: '16:9' },
    ],
    referenceBudget: { fieldIds: ['image_url', 'image_urls', 'video_urls'], modes: ['ref2v'], maxTotal: KLING_V4_FLASH_REFERENCE_LIMIT, countUniqueUrls: false, maxByType: { image: 10, video: 5 } },
    constraints: { ownedAssetModes: ['i2v', 'ref2v'], minImageSidePx: 300, maxImageSizeMB: 30, maxVideoSizeMB: 300, maxCombinedVideoDurationSec: 20, combinedDurationModes: ['ref2v'] },
  },
  updatedAt: '2026-11-05T00:00:00Z', ttlSec: 600,
  providerMeta: { provider: 'kling', modelSlug: KLING_V4_FLASH_ENDPOINTS.t2v }, brandId: 'kling', modeCaps,
};

export const KLING_V4_FLASH_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: KLING_V4_FLASH_ID, marketingName: 'Kling 4.0 Flash', cardTitle: 'Kling 4.0 Flash', provider: 'Kling by Kuaishou',
  brandId: 'kling', versionLabel: '4.0 Flash', availability: 'available', logoPolicy: 'logoAllowed', engine: KLING_V4_FLASH_ENGINE,
  modes: modes.map(mode => ({ mode, falModelId: KLING_V4_FLASH_ENDPOINTS[mode], ui: modeCaps[mode]! })),
  defaultFalModelId: KLING_V4_FLASH_ENDPOINTS.t2v,
  seo: { title: 'Kling 4.0 Flash — 720p video and references | MaxVideoAI', description: 'Create 3–20-second videos with text, an opening image or owned visual references using Kling 4.0 Flash.', canonicalPath: '/models/kling-v4-flash' },
  prompts: [],
}];
