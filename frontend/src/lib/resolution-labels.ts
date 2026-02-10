import { normalizeEngineId } from '@/lib/engine-alias';

const SORA2_PRO_RESOLUTION_LABEL = '1792×1024';

export function formatResolutionLabel(engineId: string | null | undefined, resolution: string): string {
  if (!resolution) return resolution;
  const canonical = engineId ? normalizeEngineId(engineId) ?? engineId : '';
  if (canonical === 'sora-2-pro' && resolution.toLowerCase() === '1080p') {
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
