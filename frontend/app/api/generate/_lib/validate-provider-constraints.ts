import type { Mode } from '../../../../fixtures/engineCaps';
import type { ValidationResult } from './validate-types';

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

  return { ok: true };
}
