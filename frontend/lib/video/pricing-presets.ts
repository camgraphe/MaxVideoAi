export const PRICING_COMPARISON_MODELS = ['kling-3-standard', 'kling-3-pro'] as const;
export const PRICING_COMPARISON_PRESETS = ['10s-1080p', '10s-1080p-audio'] as const;

export function resolvePricingVideoPreset(engine: string | null, preset: string | null) {
  if (!PRICING_COMPARISON_MODELS.some(id => id === engine) || !PRICING_COMPARISON_PRESETS.some(id => id === preset)) return null;
  return { durationSec: 10, durationOption: 10, resolution: '1080p', audio: preset === '10s-1080p-audio' };
}
