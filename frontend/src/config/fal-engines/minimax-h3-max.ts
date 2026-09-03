import type { AspectRatio, EngineCaps } from '../../../types/engines';
import type { RawFalEngineEntry } from './types';

export const MINIMAX_H3_MAX_ID = 'minimax-h3-max' as const;

export const MINIMAX_H3_MAX_ENDPOINTS = {
  t2v: 'minimax/h3-max/text-to-video',
  i2v: 'minimax/h3-max/image-to-video',
  ref2v: 'minimax/h3-max/reference-to-video',
} as const;

export const MINIMAX_H3_MAX_MODES = ['t2v', 'i2v', 'ref2v'] as const;
export const MINIMAX_H3_MAX_DURATION_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
export const MINIMAX_H3_MAX_RESOLUTIONS = ['480P', '768P'] as const;
export const MINIMAX_H3_MAX_TEXT_ASPECT_RATIOS = [
  '21:9',
  '16:9',
  '4:3',
  '1:1',
  '3:4',
  '9:16',
] as const satisfies readonly AspectRatio[];
export const MINIMAX_H3_MAX_PROMPT_EXPANSION_MODES = ['balanced', 'quality'] as const;

const COMMON_MODES = [...MINIMAX_H3_MAX_MODES];

const inputSchema: NonNullable<EngineCaps['inputSchema']> = {
  required: [
    {
      id: 'prompt',
      type: 'text',
      label: 'Prompt',
      description: 'Describe the characters, action, setting, camera, dialogue, and sound.',
      modes: COMMON_MODES,
      requiredInModes: COMMON_MODES,
    },
    {
      id: 'image_url',
      type: 'image',
      label: 'Start image',
      description: 'Required first frame for image-to-video.',
      modes: ['i2v'],
      requiredInModes: ['i2v'],
      minCount: 1,
      maxCount: 1,
      source: 'either',
    },
  ],
  optional: [
    {
      id: 'end_image_url',
      type: 'image',
      label: 'End image',
      description: 'Optional final frame for first-to-last-frame generation.',
      modes: ['i2v'],
      minCount: 0,
      maxCount: 1,
      source: 'either',
    },
    {
      id: 'reference_image_urls',
      type: 'image',
      label: 'Reference images',
      modes: ['ref2v'],
      minCount: 0,
      maxCount: 9,
      source: 'either',
    },
    {
      id: 'reference_video_urls',
      type: 'video',
      label: 'Reference videos',
      description: 'Each clip must be 2–15 seconds, with at most 15 seconds combined.',
      modes: ['ref2v'],
      minCount: 0,
      maxCount: 3,
      minDurationSec: 2,
      maxDurationSec: 15,
      source: 'either',
    },
    {
      id: 'reference_audio_urls',
      type: 'audio',
      label: 'Reference audio',
      description: 'Each clip must be 2–15 seconds, with at most 15 seconds combined. Audio requires an image or video reference.',
      modes: ['ref2v'],
      minCount: 0,
      maxCount: 3,
      minDurationSec: 2,
      maxDurationSec: 15,
      source: 'either',
    },
    {
      id: 'duration',
      type: 'enum',
      label: 'Duration (seconds)',
      modes: COMMON_MODES,
      values: MINIMAX_H3_MAX_DURATION_OPTIONS.map(String),
      default: '5',
      min: 5,
      max: 15,
    },
    {
      id: 'resolution',
      type: 'enum',
      label: 'Resolution',
      modes: COMMON_MODES,
      values: [...MINIMAX_H3_MAX_RESOLUTIONS],
      default: '768P',
    },
    {
      id: 'aspect_ratio',
      type: 'enum',
      label: 'Aspect ratio',
      modes: ['t2v'],
      values: [...MINIMAX_H3_MAX_TEXT_ASPECT_RATIOS],
      default: '16:9',
    },
    {
      id: 'prompt_expansion_mode',
      type: 'enum',
      label: 'Prompt expansion',
      modes: COMMON_MODES,
      values: [...MINIMAX_H3_MAX_PROMPT_EXPANSION_MODES],
      default: 'balanced',
    },
  ],
  referenceBudget: {
    fieldIds: ['reference_image_urls', 'reference_video_urls', 'reference_audio_urls'],
    modes: ['ref2v'],
    maxTotal: 12,
    countUniqueUrls: true,
  },
  constraints: {
    maxCombinedVideoDurationSec: 15,
    maxCombinedAudioDurationSec: 15,
    referenceAudioRequiresVisual: true,
  },
};

const modeCaps: NonNullable<EngineCaps['modeCaps']> = {
  t2v: {
    modes: ['t2v'],
    duration: { options: [...MINIMAX_H3_MAX_DURATION_OPTIONS], default: 5 },
    resolution: [...MINIMAX_H3_MAX_RESOLUTIONS],
    aspectRatio: [...MINIMAX_H3_MAX_TEXT_ASPECT_RATIOS],
    audioToggle: false,
    notes: 'Text-to-video with automatic native audio and balanced prompt expansion by default.',
  },
  i2v: {
    modes: ['i2v'],
    duration: { options: [...MINIMAX_H3_MAX_DURATION_OPTIONS], default: 5 },
    resolution: [...MINIMAX_H3_MAX_RESOLUTIONS],
    audioToggle: false,
    notes: 'Animate one required start image with an optional end image and automatic native audio.',
  },
  ref2v: {
    modes: ['ref2v'],
    duration: { options: [...MINIMAX_H3_MAX_DURATION_OPTIONS], default: 5 },
    resolution: [...MINIMAX_H3_MAX_RESOLUTIONS],
    audioToggle: false,
    notes: 'Combine image, video, and audio references within the Hailuo reference limits; audio requires a visual reference.',
  },
};

export const MINIMAX_H3_MAX_ENGINE: EngineCaps = {
  id: MINIMAX_H3_MAX_ID,
  label: 'MiniMax H3 Max',
  provider: 'MiniMax',
  version: 'H3 Max',
  status: 'early_access',
  latencyTier: 'fast',
  queueDepth: 0,
  region: 'global',
  modes: [...MINIMAX_H3_MAX_MODES],
  maxDurationSec: 15,
  resolutions: [...MINIMAX_H3_MAX_RESOLUTIONS] as EngineCaps['resolutions'],
  aspectRatios: [...MINIMAX_H3_MAX_TEXT_ASPECT_RATIOS],
  fps: [24],
  audio: true,
  upscale4k: false,
  extend: false,
  motionControls: false,
  keyframes: false,
  params: {},
  inputLimits: {
    videoMaxDurationSec: 15,
    audioMaxDurationSec: 15,
    promptMaxChars: 50_000,
    promptMaxCharsSource: 'official',
  },
  inputSchema,
  pricingDetails: {
    currency: 'USD',
    perSecondCents: {
      default: 8,
      byResolution: { '480P': 5, '768P': 8 },
    },
    byMode: {
      ref2v: { perSecondCents: { default: 8 } },
    },
    maxDurationSec: 15,
  },
  pricing: {
    unit: 'USD/s',
    base: 0.08,
    byResolution: { '480P': 0.05, '768P': 0.08 },
    currency: 'USD',
    notes: 'Normal output is $0.05/s at 480P or $0.08/s at 768P. Reference output is $0.08/s plus reference tokens above the included 4,096-token pool.',
  },
  updatedAt: '2026-09-03T00:00:00Z',
  ttlSec: 600,
  providerMeta: {
    provider: 'minimax',
    modelSlug: MINIMAX_H3_MAX_ENDPOINTS.t2v,
    clientErrorPolicy: 'opaque',
  },
  availability: 'limited',
  brandId: 'minimax',
  brandAssetPolicy: {
    logoAllowed: false,
    textOnly: true,
    usageNotes: 'Use text-only MiniMax attribution until approved H3 Max brand assets are present.',
  },
  modeCaps,
};

export const MINIMAX_H3_MAX_FAL_ENGINE_REGISTRY: RawFalEngineEntry[] = [{
  id: MINIMAX_H3_MAX_ID,
  marketingName: 'MiniMax H3 Max',
  cardTitle: 'MiniMax H3 Max',
  provider: 'MiniMax',
  brandId: 'minimax',
  versionLabel: 'H3 Max',
  availability: 'limited',
  logoPolicy: 'textOnly',
  billingNote: 'Your exact price is calculated before generation from output duration, resolution, mode, and verified reference-token usage.',
  engine: MINIMAX_H3_MAX_ENGINE,
  modes: MINIMAX_H3_MAX_MODES.map((mode) => ({
    mode,
    falModelId: MINIMAX_H3_MAX_ENDPOINTS[mode],
    ui: modeCaps[mode]!,
  })),
  defaultFalModelId: MINIMAX_H3_MAX_ENDPOINTS.t2v,
  seo: {
    title: 'MiniMax H3 Max – Premium Hailuo AI Video',
    description: 'Create polished native-audio video with MiniMax H3 Max from text, start and end frames, or mixed visual and audio references.',
    canonicalPath: '/models/minimax-h3-max',
  },
  type: 'Hailuo text, image, and reference video · Native audio',
  seoText: 'Create premium Hailuo video with strong prompt adherence, polished visual finish, and automatic native audio.',
  prompts: [],
}];
