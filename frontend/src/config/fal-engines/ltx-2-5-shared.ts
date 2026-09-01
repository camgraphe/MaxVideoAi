import type { EngineCaps, EngineInputSchema, EngineModeUiCaps, Resolution } from '../../../types/engines';

export const LTX_2_5_CAMERA_MOTIONS = [
  'dolly_in', 'dolly_out', 'dolly_left', 'dolly_right',
  'jib_up', 'jib_down', 'static', 'focus_shift',
] as const;
export const LTX_2_5_ASPECT_RATIOS = ['auto', '16:9', '9:16'] as const;
export const LTX_2_5_AUDIO_EXTENSIONS = ['mp3', 'ogg', 'wav', 'm4a', 'aac'];
export const LTX_2_5_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];

type LtxVariant = {
  id: 'ltx-2-5-fast' | 'ltx-2-5-pro';
  label: string;
  variant: 'Fast' | 'Pro';
  durationOptions: string[];
  providerResolutions: string[];
  engineResolutions: Resolution[];
  fps: number[];
  maxDurationSec: number;
  audioMaxDurationSec: number;
  perSecondCents: Record<string, number>;
  perSecondUsd: Record<string, number>;
  audioPerInputSecondUsd: number;
};

function createInputSchema(options: LtxVariant): EngineInputSchema {
  const generatedModes = ['t2v', 'i2v'] as const;
  return {
    required: [
      {
        id: 'prompt', type: 'text', label: 'Prompt', modes: [...generatedModes], requiredInModes: [...generatedModes],
        description: 'Provider prompt length: 1–5000 characters.',
      },
      { id: 'image_url', type: 'image', label: 'Start image', modes: ['i2v'], requiredInModes: ['i2v'], minCount: 1, maxCount: 1, source: 'either' },
      {
        id: 'audio_url', type: 'audio', label: 'Source audio', modes: ['a2v'], requiredInModes: ['a2v'], minCount: 1, maxCount: 1,
        minDurationSec: 2, maxDurationSec: options.audioMaxDurationSec, source: 'either',
        acceptedFileExtensions: LTX_2_5_AUDIO_EXTENSIONS,
        acceptedMimeTypes: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-m4a', 'audio/aac'],
        description: 'Must be a public URL or base64 data URI.',
      },
    ],
    optional: [
      { id: 'prompt', type: 'text', label: 'Prompt', modes: ['a2v'], description: 'Required when image_url is absent; provider length 1–5000 characters.' },
      { id: 'image_url', type: 'image', label: 'Optional first frame', modes: ['a2v'], minCount: 0, maxCount: 1, source: 'either', acceptedFileExtensions: LTX_2_5_IMAGE_EXTENSIONS },
      { id: 'end_image_url', type: 'image', label: 'End image', modes: ['i2v'], minCount: 0, maxCount: 1, source: 'either' },
      { id: 'duration', type: 'enum', label: 'Duration', modes: [...generatedModes], values: options.durationOptions, default: 'auto' },
      { id: 'resolution', type: 'enum', label: 'Resolution', modes: [...generatedModes], values: options.providerResolutions, default: '1080p' },
      { id: 'fps', type: 'enum', label: 'Frames per second', modes: [...generatedModes], values: options.fps.map(String), default: '25' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['t2v'], values: ['16:9', '9:16'], default: '16:9' },
      { id: 'aspect_ratio', type: 'enum', label: 'Aspect ratio', modes: ['i2v', 'a2v'], values: [...LTX_2_5_ASPECT_RATIOS], default: 'auto', description: 'For a2v, auto uses the image ratio or 16:9 when no image is supplied.' },
      { id: 'generate_audio', type: 'boolean', label: 'Generate audio', modes: [...generatedModes], default: true },
      { id: 'camera_motion', type: 'enum', label: 'Camera motion', modes: [...generatedModes], values: [...LTX_2_5_CAMERA_MOTIONS] },
      { id: 'guidance_scale', type: 'number', label: 'Guidance scale', modes: ['a2v'], min: 1, max: 50, description: 'Provider conditional default: 5 without image_url, 9 with image_url.' },
    ],
    constraints: {
      supportedAudioFormats: LTX_2_5_AUDIO_EXTENSIONS,
      supportedA2vImageFormats: LTX_2_5_IMAGE_EXTENSIONS,
      a2vPromptRequiredWithoutImage: true,
      fastHighFpsMaxDurationSec: options.variant === 'Fast' ? 10 : undefined,
      fastHighResolutionMaxDurationSec: options.variant === 'Fast' ? 10 : undefined,
      canonicalResolutionAliases: options.variant === 'Fast' ? { '4k': '2160p' } : undefined,
    },
  };
}

export function createLtx25ModeCaps(options: LtxVariant): NonNullable<EngineCaps['modeCaps']> {
  const generated = (mode: 't2v' | 'i2v'): EngineModeUiCaps => ({
    modes: [mode],
    duration: { options: options.durationOptions, default: 'auto' },
    resolution: options.providerResolutions,
    aspectRatio: mode === 't2v' ? ['16:9', '9:16'] : [...LTX_2_5_ASPECT_RATIOS],
    fps: options.fps,
    audioToggle: true,
    notes: options.providerResolutions.includes('2160p')
      ? 'Provider resolution 2160p is preserved; Task 4 owns any canonical 4k-to-2160p request mapping.'
      : 'Native-audio generation with provider-published duration, resolution, and fps controls.',
  });
  return {
    t2v: generated('t2v'),
    i2v: generated('i2v'),
    a2v: {
      modes: ['a2v'],
      resolution: ['1080p'],
      resolutionLocked: true,
      aspectRatio: [...LTX_2_5_ASPECT_RATIOS],
      audioToggle: false,
      notes: `Requires 2–${options.audioMaxDurationSec}s source audio. Output duration, resolution, and fps are not provider controls.`,
    },
  };
}

export function createLtx25Engine(options: LtxVariant): EngineCaps {
  const modeCaps = createLtx25ModeCaps(options);
  return {
    id: options.id,
    label: options.label,
    provider: 'Lightricks',
    version: '2.5',
    variant: options.variant,
    status: 'live',
    latencyTier: options.variant === 'Fast' ? 'fast' : 'standard',
    queueDepth: 0,
    region: 'global',
    modes: ['t2v', 'i2v', 'a2v'],
    maxDurationSec: options.maxDurationSec,
    resolutions: options.engineResolutions,
    aspectRatios: [...LTX_2_5_ASPECT_RATIOS],
    fps: options.fps,
    audio: true,
    upscale4k: false,
    extend: false,
    motionControls: true,
    keyframes: false,
    params: {},
    inputLimits: {
      audioMaxDurationSec: options.audioMaxDurationSec,
      promptMaxChars: 5000,
      promptMaxCharsSource: 'official',
    },
    inputSchema: createInputSchema(options),
    pricingDetails: {
      currency: 'USD',
      perSecondCents: { default: options.perSecondCents['1080p'], byResolution: options.perSecondCents },
      byMode: {
        a2v: {
          perSecondCents: {
            default: options.audioPerInputSecondUsd * 100,
            byResolution: { '1080p': options.audioPerInputSecondUsd * 100 },
          },
          durationBasis: 'input_audio',
        },
      },
    },
    pricing: {
      unit: 'USD/s', base: options.perSecondUsd['1080p'], byResolution: options.perSecondUsd, currency: 'USD',
      notes: `Text/image provider cost is per output second. Audio-to-video is $${options.audioPerInputSecondUsd.toFixed(2)} per input-audio second at 1080p and uses canonical input-duration facts.`,
    },
    updatedAt: '2026-09-01T12:00:20Z',
    ttlSec: 600,
    providerMeta: { provider: 'lightricks' },
    availability: 'available',
    brandId: 'lightricks',
    brandAssetPolicy: { logoAllowed: false, textOnly: true, usageNotes: 'Use text-only Lightricks attribution until approved brand assets are present.' },
    modeCaps,
  };
}
