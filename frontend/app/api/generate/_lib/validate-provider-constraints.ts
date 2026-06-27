import type { Mode } from '../../../../fixtures/engineCaps';
import {
  isKlingMultiPromptEngine,
  KLING_MULTI_PROMPT_SCENE_MAX_CHARS,
} from '../../../../src/lib/kling-provider-limits';
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
  if (isKlingMultiPromptEngine(params.engineId) && Array.isArray(params.payload['multi_prompt'])) {
    const multiPrompt = params.payload['multi_prompt'];
    for (let index = 0; index < multiPrompt.length; index += 1) {
      const entry = multiPrompt[index];
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const prompt = (entry as { prompt?: unknown }).prompt;
      if (typeof prompt !== 'string' || prompt.length <= KLING_MULTI_PROMPT_SCENE_MAX_CHARS) continue;
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: `multi_prompt[${index}].prompt`,
          message: `Kling multi-prompt scene prompts must be at most ${KLING_MULTI_PROMPT_SCENE_MAX_CHARS} characters.`,
          allowed: [KLING_MULTI_PROMPT_SCENE_MAX_CHARS],
          value: prompt.length,
        },
      };
    }
  }

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
