import { finishingSettingsSchemas, type FinishingToolId, type FinishingSettings } from '@/lib/toolbox/finishing';
import type { VideoMetadata } from './upscale-request-utils';

export type FinishingProfile = {
  id: string; endpoint: string; model?: string; generative: boolean;
  pricingSource: string; maxSeconds: number;
};
/** Candidate routing, reviewed against fal's API schemas on 2026-09-08.
 * Qualification, not the provider's marketing label, controls activation.
 */
export const FINISHING_PROFILES: Record<FinishingToolId, Partial<Record<'standard' | 'pro', FinishingProfile>>> = {
  'restore-video': {
    standard: { id: 'restore-bytedance-standard-v1', endpoint: 'fal-ai/bytedance-upscaler/upscale/video', generative: false, maxSeconds: 60, pricingSource: 'https://fal.ai/models/fal-ai/bytedance-upscaler/upscale/video' },
    pro: { id: 'restore-bytedance-pro-v1', endpoint: 'fal-ai/bytedance-upscaler/upscale/video', generative: true, maxSeconds: 60, pricingSource: 'https://fal.ai/models/fal-ai/bytedance-upscaler/upscale/video' },
  },
  denoise: {
    standard: { id: 'denoise-nyx-fast-v1', endpoint: 'topaz/denoise/video', model: 'Nyx Fast', generative: false, maxSeconds: 60, pricingSource: 'https://fal.ai/models/topaz/denoise/video' },
    pro: { id: 'denoise-nyx-v1', endpoint: 'topaz/denoise/video', model: 'Nyx', generative: false, maxSeconds: 60, pricingSource: 'https://fal.ai/models/topaz/denoise/video' },
  },
  'fix-blur': {
    standard: { id: 'deblur-themis-v1', endpoint: 'topaz/deblur/video', generative: false, maxSeconds: 60, pricingSource: 'https://fal.ai/models/topaz/deblur/video' },
  },
  'smooth-motion': {
    standard: { id: 'motion-apollo-v1', endpoint: 'topaz/interpolate/video', model: 'Apollo', generative: false, maxSeconds: 60, pricingSource: 'https://fal.ai/models/topaz/interpolate/video' },
    pro: { id: 'motion-aion-v1', endpoint: 'topaz/interpolate/video', model: 'Aion', generative: false, maxSeconds: 60, pricingSource: 'https://fal.ai/models/topaz/interpolate/video' },
  },
};

export function prepareFinishingProvider(toolId: FinishingToolId, rawSettings: unknown, sourceUrl: string, facts: VideoMetadata) {
  const settings = finishingSettingsSchemas[toolId].parse(rawSettings);
  const profile = FINISHING_PROFILES[toolId][settings.quality];
  if (!profile) throw new Error('Unsupported quality.');
  if (![facts.width, facts.height, facts.durationSec, facts.fps].every(v => typeof v === 'number' && Number.isFinite(v) && v > 0)) throw new Error('Measured video metadata is required.');
  if (facts.durationSec > profile.maxSeconds) throw new Error('Use a video of 60 seconds or less.');
  if (facts.width * facts.height > 3840 * 2160 || facts.fps! > 60) throw new Error('Use a source up to 4K and 60 fps.');
  const input: Record<string, unknown> = { video_url: sourceUrl };
  if (toolId === 'restore-video' && 'resolution' in settings) {
    // Keep the measured source cadence; never apply the provider's default 30 fps silently.
    Object.assign(input, { target_resolution: settings.resolution, target_fps: facts.fps, enhancement_preset: 'general', enhancement_tier: settings.quality, fidelity: 'high', bit_depth: 8 });
  } else {
    input.H264_output = true;
    if (profile.model) input.model = profile.model;
    if (toolId === 'denoise' && 'strength' in settings) {
      input.upscale_factor = 1;
      if (settings.strength !== 'auto') input.noise = settings.strength === 'light' ? 0.25 : 0.75;
    }
    if (toolId === 'smooth-motion' && 'fps' in settings) {
      if (settings.fps <= facts.fps!) throw new Error('Choose a frame rate above the source frame rate.');
      Object.assign(input, { target_fps: settings.fps, slowdown_factor: 1 });
    }
  }
  return { profile, input, settings };
}

/** Conservative vendor budget from published examples, NOT an invoice or a verified
 * per-frame rate. Topaz quotes round up to a complete 300-frame example block.
 * The release gate requires measured quote/invoice reconciliation before charging.
 */
export function estimateFinishingVendorBudget(toolId: FinishingToolId, settings: FinishingSettings, facts: VideoMetadata): number {
  prepareFinishingProvider(toolId, settings, 'https://source.example/video.mp4', facts);
  if (toolId === 'restore-video' && 'resolution' in settings) {
    return facts.durationSec * (facts.fps! / 30) * (settings.resolution === '4k' ? 0.0288 : 0.0072) * (settings.quality === 'pro' ? 10 : 1);
  }
  const pixels = facts.width * facts.height;
  const is4k = pixels > 1920 * 1080;
  const frames = facts.durationSec * (toolId === 'smooth-motion' && 'fps' in settings ? settings.fps - facts.fps! : facts.fps!);
  const blocks = Math.ceil(frames / 300);
  const exampleUsd = toolId === 'denoise'
    ? settings.quality === 'pro' ? is4k ? 0.6 : pixels > 1280 * 720 ? 0.2 : 0.1 : is4k ? 0.3 : 0.1
    : toolId === 'fix-blur' ? is4k ? 0.3 : 0.1
    : settings.quality === 'pro' ? is4k ? 1.7 : 0.5 : is4k ? 0.6 : 0.3;
  return blocks * exampleUsd;
}
