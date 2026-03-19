import { getAngleToolEngine } from '@/config/tools-angle-engines';
import type { AngleToolEngineId, AngleToolNumericParams } from '@/types/tools-angle';

export const ANGLE_ROTATION_MIN = 0;
export const ANGLE_ROTATION_MAX = 360;
export const ANGLE_TILT_MIN = -30;
export const ANGLE_TILT_MAX = 30;
export const ANGLE_ZOOM_MIN = 0;
export const ANGLE_ZOOM_MAX = 10;

export const CINEMA_SAFE_ROTATION_LIMIT = 25;
export const CINEMA_SAFE_TILT_LIMIT = 15;
export const CINEMA_SAFE_ZOOM_MAX = 3;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeRotation(rotation: number): number {
  const wrapped = ((rotation % 360) + 360) % 360;
  return wrapped;
}

export function toSignedRotation(rotation: number): number {
  const normalized = normalizeRotation(rotation);
  return normalized > 180 ? normalized - 360 : normalized;
}

export function toAbsoluteRotation(signedRotation: number): number {
  return normalizeRotation(signedRotation);
}

export function sanitizeAngleParams(params: AngleToolNumericParams): AngleToolNumericParams {
  return {
    rotation: normalizeRotation(clamp(params.rotation, ANGLE_ROTATION_MIN, ANGLE_ROTATION_MAX)),
    tilt: clamp(params.tilt, ANGLE_TILT_MIN, ANGLE_TILT_MAX),
    zoom: clamp(params.zoom, ANGLE_ZOOM_MIN, ANGLE_ZOOM_MAX),
  };
}

export function applyCinemaSafeParams(
  params: AngleToolNumericParams,
  safeMode: boolean
): AngleToolNumericParams & { safeApplied: boolean } {
  const sanitized = sanitizeAngleParams(params);
  if (!safeMode) {
    return { ...sanitized, safeApplied: false };
  }

  const safeTilt = clamp(sanitized.tilt, -CINEMA_SAFE_TILT_LIMIT, CINEMA_SAFE_TILT_LIMIT);
  const safeZoom = clamp(sanitized.zoom, ANGLE_ZOOM_MIN, CINEMA_SAFE_ZOOM_MAX);

  return {
    rotation: sanitized.rotation,
    tilt: safeTilt,
    zoom: safeZoom,
    safeApplied:
      Math.abs(safeTilt - sanitized.tilt) > 0.0001 ||
      Math.abs(safeZoom - sanitized.zoom) > 0.0001,
  };
}

export function estimateAngleCostUsd(engineId: AngleToolEngineId, width?: number | null, height?: number | null): number {
  const engine = getAngleToolEngine(engineId);
  const pixels = typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 ? width * height : 1_000_000;
  const megapixels = Math.max(1, pixels / 1_000_000);
  return Number((engine.estimatedCostUsdPerMp * megapixels).toFixed(4));
}

export function resolveAngleEngineForParams(
  engineId: AngleToolEngineId,
  params: Pick<AngleToolNumericParams, 'tilt'>
): AngleToolEngineId {
  if (engineId === 'flux-multiple-angles' && params.tilt < 0) {
    return 'qwen-multiple-angles';
  }
  return engineId;
}

export function mapTiltForEngine(engineId: AngleToolEngineId, tilt: number): number {
  if (engineId === 'flux-multiple-angles') {
    return clamp(Math.max(0, tilt) * 2, 0, 60);
  }
  if (engineId === 'qwen-multiple-angles') {
    return clamp(tilt, -30, 30);
  }
  return tilt;
}
