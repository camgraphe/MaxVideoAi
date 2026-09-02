import type { EngineCaps } from '../../../types/engines';

export const WAN_3_PROVIDER_ASPECT_RATIOS = ['adaptive', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
export const WAN_3_RESOLUTIONS = ['480p', '720p', '1080p'] as const;
export const WAN_3_MODES = ['t2v', 'i2v', 'ref2v'] as const;

const UI_ASPECT_RATIOS = ['auto', '16:9', '4:3', '1:1', '3:4', '9:16'];
const COMMON_MODES = [...WAN_3_MODES];

export const WAN_3_MODE_CAPS: NonNullable<EngineCaps['modeCaps']> = {
  t2v: {
    modes: ['t2v'],
    duration: { min: 2, default: 5 },
    resolution: [...WAN_3_RESOLUTIONS],
    aspectRatio: UI_ASPECT_RATIOS,
    fps: 30,
    audioToggle: true,
    notes: 'Provider aspect value adaptive is shown as Auto; Task 4 owns the explicit request mapping.',
  },
  i2v: {
    modes: ['i2v'],
    duration: { min: 2, default: 5 },
    resolution: [...WAN_3_RESOLUTIONS],
    aspectRatio: UI_ASPECT_RATIOS,
    fps: 30,
    audioToggle: true,
    notes: 'One required start image and one optional end image; no upload-size limit is published.',
  },
  ref2v: {
    modes: ['ref2v'],
    duration: { min: 2, default: 5 },
    resolution: [...WAN_3_RESOLUTIONS],
    aspectRatio: UI_ASPECT_RATIOS,
    fps: 30,
    audioToggle: true,
    maxUploadMB: 100,
    notes: 'At least one image, video, audio, file, or public-web reference is required. File/web references require thinking and cannot be combined.',
  },
};

export const WAN_3_INPUT_SCHEMA: NonNullable<EngineCaps['inputSchema']> = {
  required: [
    {
      id: 'prompt', type: 'text', label: 'Prompt', modes: ['t2v'], requiredInModes: ['t2v'],
      description: 'Provider prompt length: 1–5000 characters.',
    },
    {
      id: 'start_image_url', type: 'image', label: 'Start image', modes: ['i2v'], requiredInModes: ['i2v'],
      minCount: 1, maxCount: 1, source: 'either',
    },
  ],
  optional: [
    { id: 'prompt', type: 'text', label: 'Prompt', modes: ['i2v', 'ref2v'], description: 'Provider maximum: 5000 characters.' },
    { id: 'end_image_url', type: 'image', label: 'End image', modes: ['i2v'], minCount: 0, maxCount: 1, source: 'either', description: 'Only valid with start_image_url.' },
    { id: 'reference_image_urls', type: 'image', label: 'Reference images', modes: ['ref2v'], minCount: 0, maxCount: 10, maxSizeMB: 20, source: 'either' },
    { id: 'reference_video_urls', type: 'video', label: 'Reference videos', modes: ['ref2v'], minCount: 0, maxCount: 5, maxDurationSec: 15, maxSizeMB: 100, source: 'either', description: 'Combined video duration <=15 seconds; each video must be >=16 fps.' },
    { id: 'reference_audio_urls', type: 'audio', label: 'Reference audio', modes: ['ref2v'], minCount: 0, maxCount: 5, maxDurationSec: 15, maxSizeMB: 15, source: 'either', description: 'Combined audio duration <=15 seconds.' },
    { id: 'file_url', type: 'text', label: 'Reference file URL', modes: ['ref2v'], minCount: 0, maxCount: 1, source: 'url', description: 'Requires enable_thinking=true and cannot combine with web_url.' },
    { id: 'web_url', type: 'text', label: 'Public web URL', modes: ['ref2v'], minCount: 0, maxCount: 1, source: 'url', description: 'Requires enable_thinking=true and cannot combine with file_url.' },
    { id: 'enable_thinking', type: 'boolean', label: 'Thinking', modes: COMMON_MODES, default: false },
    { id: 'duration', type: 'number', label: 'Duration (seconds)', modes: COMMON_MODES, min: 2, max: 30, step: 1, default: 5, description: 'Provider also accepts null for smart duration.' },
    { id: 'enable_safety_checker', type: 'boolean', label: 'Safety checker', modes: COMMON_MODES, default: true },
    { id: 'resolution', type: 'enum', label: 'Resolution', modes: COMMON_MODES, values: [...WAN_3_RESOLUTIONS], default: '1080p' },
    { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: COMMON_MODES, values: [...WAN_3_PROVIDER_ASPECT_RATIOS], default: 'adaptive' },
    { id: 'seed', type: 'number', label: 'Seed', modes: COMMON_MODES, min: 0, max: 2147483647, step: 1 },
    { id: 'audio', type: 'boolean', label: 'Generate audio', modes: COMMON_MODES, default: true },
    { id: 'enable_prompt_expansion', type: 'boolean', label: 'Prompt expansion', modes: COMMON_MODES, default: true },
  ],
  constraints: {
    maxCombinedVideoDurationSec: 15,
    maxCombinedAudioDurationSec: 15,
    minimumReferenceVideoFps: 16,
    atLeastOneReferenceField: ['reference_image_urls', 'reference_video_urls', 'reference_audio_urls', 'file_url', 'web_url'],
    fileOrWebRequiresThinking: true,
    fileAndWebMutuallyExclusive: true,
  },
};

export function createWan3Engine(options: {
  id: string;
  label: string;
  version: string;
  perSecondCents: Record<string, number>;
  perSecondUsd: Record<string, number>;
}): EngineCaps {
  return {
    id: options.id,
    label: options.label,
    provider: 'Alibaba',
    version: options.version,
    status: 'live',
    latencyTier: 'standard',
    queueDepth: 0,
    region: 'global',
    modes: [...WAN_3_MODES],
    maxDurationSec: 30,
    resolutions: [...WAN_3_RESOLUTIONS],
    aspectRatios: ['auto', '16:9', '4:3', '1:1', '3:4', '9:16'],
    fps: [30],
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: false,
    keyframes: false,
    params: {},
    inputLimits: { promptMaxChars: 5000, promptMaxCharsSource: 'official' },
    inputSchema: WAN_3_INPUT_SCHEMA,
    pricingDetails: { currency: 'USD', perSecondCents: { default: options.perSecondCents['1080p'], byResolution: options.perSecondCents } },
    pricing: { unit: 'USD/s', base: options.perSecondUsd['1080p'], byResolution: options.perSecondUsd, currency: 'USD', notes: 'Fal provider cost per generated output second, selected by resolution.' },
    updatedAt: '2026-09-01T12:00:20Z',
    ttlSec: 600,
    providerMeta: { provider: 'alibaba' },
    availability: 'available',
    brandId: 'wan',
    brandAssetPolicy: { logoAllowed: false, textOnly: true, usageNotes: 'Use text-only Alibaba attribution until approved brand assets are present.' },
    modeCaps: WAN_3_MODE_CAPS,
  };
}
