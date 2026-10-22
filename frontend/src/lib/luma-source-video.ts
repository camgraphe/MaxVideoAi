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
  if (params.durationSec !== 5 && params.durationSec !== 10) return 'Select a 5s or 10s output for Luma.';
  // Published Modify prices cover these two source lengths only. Do not round
  // fractional sources or infer an arbitrary-duration supplier price.
  if (params.mode === 'v2v' && source !== params.durationSec) {
    return 'Luma Modify keeps the source duration. Trim the source to exactly 5s or 10s and select the matching duration.';
  }
  return null;
}
