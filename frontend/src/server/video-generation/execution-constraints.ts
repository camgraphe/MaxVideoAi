import { isKlingMultiPromptEngine, KLING_MULTI_PROMPT_SCENE_MAX_CHARS } from '@/lib/kling-provider-limits';
import type { EngineModeDurationCaps, Mode } from '@/types/engines';

export type VideoExecutionValidationResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        field?: string;
        allowed?: Array<string | number>;
        value?: unknown;
      };
    };

export function normalizeVideoDurationOption(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/\d/u.test(trimmed)) return trimmed;
  const numeric = Number(trimmed.replace(/[^\d.]/gu, ''));
  return Number.isFinite(numeric) ? Math.round(numeric) : trimmed;
}

export function isVideoDurationSupported(
  value: unknown,
  caps: EngineModeDurationCaps,
  maxDurationSec?: number,
): boolean {
  const normalized = normalizeVideoDurationOption(value);
  if (normalized === undefined) return false;
  if (
    typeof normalized === 'number'
    && typeof maxDurationSec === 'number'
    && normalized > maxDurationSec
  ) {
    return false;
  }
  if ('options' in caps) {
    return caps.options.some((option) => normalizeVideoDurationOption(option) === normalized);
  }
  return typeof normalized === 'number' && normalized >= caps.min;
}

export function validateProviderSpecificConstraints(params: {
  engineId: string;
  normalizedMode: Mode;
  payload: Record<string, unknown>;
}): VideoExecutionValidationResult {
  if (isKlingMultiPromptEngine(params.engineId) && Array.isArray(params.payload.multi_prompt)) {
    for (let index = 0; index < params.payload.multi_prompt.length; index += 1) {
      const entry = params.payload.multi_prompt[index];
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
    const endImageUrl = typeof params.payload.end_image_url === 'string'
      && params.payload.end_image_url.trim().length
      ? params.payload.end_image_url.trim()
      : null;
    const resolution = typeof params.payload.resolution === 'string'
      ? params.payload.resolution.trim()
      : '';
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
    params.engineId === 'luma-ray-3-2'
    && (params.normalizedMode === 't2v' || params.normalizedMode === 'i2v')
    && params.payload.loop === true
    && normalizeVideoDurationOption(params.payload.duration ?? params.payload.duration_seconds) === 10
  ) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'loop',
        message: 'Luma Ray 3.2 loop is only supported for 5s public requests.',
        allowed: ['5s without loop conflict'],
        value: params.payload.duration ?? params.payload.duration_seconds,
      },
    };
  }

  return { ok: true };
}

export function validateProviderControls(
  payload: Record<string, unknown>,
): VideoExecutionValidationResult {
  const seed = payload.seed;
  if (
    seed !== undefined
    && (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 2_147_483_647)
  ) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'seed',
        message: 'Seed must be an integer between 0 and 2147483647',
        allowed: [0, 2_147_483_647],
        value: seed,
      },
    };
  }

  const safetyChecker = payload.enable_safety_checker;
  if (safetyChecker !== undefined && typeof safetyChecker !== 'boolean') {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'enable_safety_checker',
        message: 'Safety checker must be true or false',
        value: safetyChecker,
      },
    };
  }

  return { ok: true };
}
