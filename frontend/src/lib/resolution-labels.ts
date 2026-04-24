const SORA2_PRO_RESOLUTION_LABEL = '1792×1024';
const SORA2_PRO_ALIASES = new Set([
  'sora-2-pro',
  'sora2pro',
  'sora-pro',
  'openai-sora-2-pro',
  'fal-ai/sora-2-pro',
]);

export function formatResolutionLabel(engineId: string | null | undefined, resolution: string): string {
  if (!resolution) return resolution;
  const normalizedEngineId = engineId?.trim().toLowerCase() ?? '';
  if (SORA2_PRO_ALIASES.has(normalizedEngineId) && resolution.toLowerCase() === '1080p') {
    return SORA2_PRO_RESOLUTION_LABEL;
  }
  return resolution;
}

export function formatResolutionList(
  engineId: string | null | undefined,
  resolutions: string[]
): string[] {
  return resolutions.map((resolution) => formatResolutionLabel(engineId, resolution));
}

export const SORA2_PRO_DISPLAY_RESOLUTION = SORA2_PRO_RESOLUTION_LABEL;
