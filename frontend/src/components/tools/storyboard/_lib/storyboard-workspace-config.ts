import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { StoryboardStyle, StoryboardTargetModel } from './storyboard-prompt';
import { STORYBOARD_REFERENCE_SUPPORTED_FORMATS } from './storyboard-reference-library';

export const STORYBOARD_STYLE_OPTIONS: StoryboardStyle[] = ['realistic', 'anime', 'ugc', 'cinema'];
export const STORYBOARD_TARGET_OPTIONS: StoryboardTargetModel[] = ['seedance', 'kling'];
export const STORYBOARD_TARGET_LOGOS: Record<StoryboardTargetModel, { src: string }> = {
  seedance: { src: '/brand/partners/bytedance/bytedance-mark-light.svg' },
  kling: { src: '/brand/partners/kling/kling-mark-light.png' },
};
export const STORYBOARD_REFERENCE_SLOT_COUNT = 4;
export const STORYBOARD_REFERENCE_FIELD: EngineInputField = {
  id: 'storyboard_reference_images',
  type: 'image',
  label: 'Reference images',
  description: 'Upload character, product, object, packaging, scene or style references.',
  maxCount: STORYBOARD_REFERENCE_SLOT_COUNT,
  minCount: 0,
};
export const STORYBOARD_REFERENCE_ENGINE: EngineCaps = {
  id: 'gpt-image-2',
  label: 'Storyboarder',
  provider: 'MaxVideoAI',
  status: 'live',
  latencyTier: 'standard',
  modes: ['i2i'],
  maxDurationSec: 0,
  resolutions: ['1k'],
  aspectRatios: ['4:3'],
  fps: [],
  audio: false,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: { imageMaxMB: 25 },
  inputSchema: { constraints: { supportedFormats: STORYBOARD_REFERENCE_SUPPORTED_FORMATS, maxImageSizeMB: 25 } },
  updatedAt: '2026-06-03',
  ttlSec: 3600,
  availability: 'available',
};
