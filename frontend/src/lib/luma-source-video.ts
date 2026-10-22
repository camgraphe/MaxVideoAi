/** Agents API limits reviewed 2026-10-22. Modify output inherits source timing. */
export const LUMA_MODIFY_SOURCE_MAX_SEC = 18;
export const LUMA_REFRAME_SOURCE_MAX_SEC = 10;

export function isLumaSourceVideoMode(engineId: string | undefined, mode: string): boolean {
  return engineId === 'luma-ray-3-2' && (mode === 'v2v' || mode === 'reframe');
}

/** Only call with server-resolved owned source metadata, never browser declarations. */
export function validateLumaSourceVideoTiming(params: {
  engineId?: string;
  mode: string;
  sourceDurationSec?: number | null;
  durationSec: number;
}): string | null {
  if (!isLumaSourceVideoMode(params.engineId, params.mode)) return null;
  const source = params.sourceDurationSec;
  if (typeof source !== 'number' || !Number.isFinite(source) || source <= 0) {
    return 'Upload a source video with verified duration before using Luma Modify or Reframe.';
  }
  const maximum = params.mode === 'v2v' ? LUMA_MODIFY_SOURCE_MAX_SEC : LUMA_REFRAME_SOURCE_MAX_SEC;
  if (source > maximum) return `Source video must be ${maximum}s or shorter for Luma ${params.mode === 'v2v' ? 'Modify' : 'Reframe'}.`;
  if (params.mode === 'reframe' && params.durationSec !== 5 && params.durationSec !== 10) {
    return 'Select a 5s or 10s output for Luma Reframe.';
  }
  return null;
}

/** Customer tariff quantity only. Modify sends no duration override to Luma. */
export function lumaModifyTariffDurationSec(sourceDurationSec: number): number {
  if (!Number.isFinite(sourceDurationSec) || sourceDurationSec <= 0 || sourceDurationSec > LUMA_MODIFY_SOURCE_MAX_SEC) {
    throw new Error('A verified Luma Modify source of at most 18s is required.');
  }
  return Math.max(5, Math.ceil(sourceDurationSec));
}
