import type { Mode } from '../../../../fixtures/engineCaps';
import type { ValidationResult } from './validate-types';

function isTenSecondDuration(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value) === 10;
  }
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) && Math.round(numeric) === 10;
  }
  return false;
}

export function validateProviderSpecificConstraints(params: {
  engineId: string;
  normalizedMode: Mode;
  payload: Record<string, unknown>;
}): ValidationResult {
  if (params.engineId === 'minimax-hailuo-02-text' && params.normalizedMode === 'i2v') {
    const endImageUrl =
      typeof params.payload['end_image_url'] === 'string' && params.payload['end_image_url'].trim().length
        ? params.payload['end_image_url'].trim()
        : null;
    const resolution = typeof params.payload['resolution'] === 'string' ? params.payload['resolution'].trim() : '';

    if (endImageUrl && resolution.toUpperCase() === '512P') {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'resolution',
          message: 'Hailuo 02 end frame image-to-video requires 768P. Switch resolution to 768P or remove the end frame.',
          allowed: ['768P'],
          value: resolution,
        },
      };
    }
  }

  if (
    params.engineId === 'luma-ray-3-2' &&
    (params.normalizedMode === 't2v' || params.normalizedMode === 'i2v') &&
    params.payload['loop'] === true &&
    isTenSecondDuration(params.payload['duration'] ?? params.payload['duration_seconds'])
  ) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'loop',
        message: 'Luma Ray 3.2 loop is only supported for 5s public requests.',
        allowed: ['5s without loop conflict'],
        value: params.payload['duration'] ?? params.payload['duration_seconds'],
      },
    };
  }

  return { ok: true };
}
