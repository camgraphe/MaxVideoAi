import type { Mode } from '../../../../fixtures/engineCaps';
import {
  isKlingMultiPromptEngine,
  isKlingOmniEngine,
  KLING_MULTI_PROMPT_SCENE_MAX_CHARS,
  KLING_PROVIDER_PROMPT_MAX_CHARS,
  normalizeKlingOmniPromptReferences,
} from '../../../../src/lib/kling-provider-limits';
import type { ValidationResult } from './validate-types';
import {
  MINIMAX_H3_ASPECT_RATIOS,
  MINIMAX_H3_RESOLUTIONS,
} from '../../../../src/config/fal-engines/minimax-h3';
import { isMinimaxH3EngineId } from '../../../../src/lib/minimax-h3';

const MINIMAX_H3_MODES = ['t2v', 'i2v', 'ref2v'] as const;

function minimaxH3Error(
  field: string,
  message: string,
  allowed?: Array<string | number>,
  value?: unknown
): ValidationResult {
  return {
    ok: false,
    error: {
      code: 'ENGINE_CONSTRAINT',
      field,
      message,
      ...(allowed ? { allowed } : {}),
      ...(value !== undefined ? { value } : {}),
    },
  };
}

function minimaxH3StrictInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function minimaxH3UrlList(payload: Record<string, unknown>, field: string): string[] | null {
  const raw = payload[field];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  if (raw.some((value) => typeof value !== 'string' || !value.trim())) return null;
  return Array.from(new Set(raw.map((value) => (value as string).trim())));
}

function validateMinimaxH3Constraints(params: {
  normalizedMode: Mode;
  payload: Record<string, unknown>;
}): ValidationResult {
  const { normalizedMode, payload } = params;
  if (!MINIMAX_H3_MODES.includes(normalizedMode as (typeof MINIMAX_H3_MODES)[number])) {
    return minimaxH3Error('mode', 'MiniMax H3 supports text, image, and reference video modes only.', [...MINIMAX_H3_MODES], normalizedMode);
  }

  const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';
  if (!prompt.trim()) return minimaxH3Error('prompt', 'Prompt is required for MiniMax H3.');
  if (prompt.length > 7000) return minimaxH3Error('prompt', 'MiniMax H3 prompts must be at most 7000 characters.', [7000], prompt.length);

  const duration = minimaxH3StrictInteger(payload.duration ?? payload.duration_seconds);
  if (duration === null || duration < 5 || duration > 15) {
    return minimaxH3Error('duration', 'MiniMax H3 duration must be an integer from 5 through 15 seconds.', [5, 15], payload.duration ?? payload.duration_seconds);
  }

  const resolution = typeof payload.resolution === 'string' ? payload.resolution.trim() : '';
  if (!MINIMAX_H3_RESOLUTIONS.includes(resolution as (typeof MINIMAX_H3_RESOLUTIONS)[number])) {
    return minimaxH3Error('resolution', 'MiniMax H3 resolution must be 768P, 2K, or 4K.', [...MINIMAX_H3_RESOLUTIONS], resolution);
  }

  for (const field of ['generate_audio', 'audio'] as const) {
    if (field in payload) return minimaxH3Error(field, `MiniMax H3 generates native audio and does not accept ${field}.`);
  }
  for (const field of ['image_urls', 'video_urls', 'audio_urls'] as const) {
    if (field in payload) return minimaxH3Error(field, `MiniMax H3 requires its reference_* provider field names.`);
  }

  if (normalizedMode === 'i2v') {
    if ('aspect_ratio' in payload) {
      return minimaxH3Error('aspect_ratio', 'MiniMax H3 image-to-video follows the source image and does not accept aspect_ratio.');
    }
    if (typeof payload.image_url !== 'string' || !payload.image_url.trim()) {
      return minimaxH3Error('image_url', 'MiniMax H3 image-to-video requires exactly one start image.');
    }
    if ('end_image_url' in payload && (typeof payload.end_image_url !== 'string' || !payload.end_image_url.trim())) {
      return minimaxH3Error('end_image_url', 'MiniMax H3 end_image_url must be one non-empty URL.');
    }
    return { ok: true };
  }

  const aspectRatio = typeof payload.aspect_ratio === 'string' ? payload.aspect_ratio.trim() : '';
  if (!MINIMAX_H3_ASPECT_RATIOS.includes(aspectRatio as (typeof MINIMAX_H3_ASPECT_RATIOS)[number])) {
    return minimaxH3Error('aspect_ratio', 'MiniMax H3 aspect ratio is unsupported.', [...MINIMAX_H3_ASPECT_RATIOS], aspectRatio);
  }
  if (normalizedMode === 't2v') return { ok: true };

  const referenceImageUrls = minimaxH3UrlList(payload, 'reference_image_urls');
  const referenceVideoUrls = minimaxH3UrlList(payload, 'reference_video_urls');
  const referenceAudioUrls = minimaxH3UrlList(payload, 'reference_audio_urls');
  if (!referenceImageUrls) return minimaxH3Error('reference_image_urls', 'MiniMax H3 reference images must be a URL array.');
  if (!referenceVideoUrls) return minimaxH3Error('reference_video_urls', 'MiniMax H3 reference videos must be a URL array.');
  if (!referenceAudioUrls) return minimaxH3Error('reference_audio_urls', 'MiniMax H3 reference audio must be a URL array.');
  if (referenceImageUrls.length > 9) return minimaxH3Error('reference_image_urls', 'MiniMax H3 supports up to 9 reference images.', [0, 9], referenceImageUrls.length);
  if (referenceVideoUrls.length > 3) return minimaxH3Error('reference_video_urls', 'MiniMax H3 supports up to 3 reference videos.', [0, 3], referenceVideoUrls.length);
  if (referenceAudioUrls.length > 3) return minimaxH3Error('reference_audio_urls', 'MiniMax H3 supports up to 3 reference audio clips.', [0, 3], referenceAudioUrls.length);
  if (!referenceImageUrls.length && !referenceVideoUrls.length) {
    return minimaxH3Error(
      referenceAudioUrls.length ? 'reference_audio_urls' : 'reference_image_urls',
      'MiniMax H3 reference mode requires at least one image or video; audio cannot be used alone.'
    );
  }
  const uniqueReferences = new Set([
    ...referenceImageUrls,
    ...referenceVideoUrls,
    ...referenceAudioUrls,
  ]);
  if (uniqueReferences.size > 12) {
    return minimaxH3Error('referenceBudget', 'MiniMax H3 supports up to 12 unique references.', [0, 12], uniqueReferences.size);
  }
  return { ok: true };
}

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
  if (isMinimaxH3EngineId(params.engineId)) {
    return validateMinimaxH3Constraints(params);
  }

  if (isKlingMultiPromptEngine(params.engineId) && Array.isArray(params.payload['multi_prompt'])) {
    const multiPrompt = params.payload['multi_prompt'];
    const hasMultiPrompt = multiPrompt.some((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
      const prompt = (entry as { prompt?: unknown }).prompt;
      return typeof prompt === 'string' && prompt.trim().length > 0;
    });
    const endImageUrl =
      typeof params.payload['end_image_url'] === 'string' ? params.payload['end_image_url'].trim() : '';
    if (hasMultiPrompt && endImageUrl) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'end_image_url',
          message: 'Kling end frame inputs cannot be combined with a multi-prompt shot plan.',
        },
      };
    }
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

  if (isKlingOmniEngine(params.engineId) && typeof params.payload.prompt === 'string') {
    const providerPromptLength = normalizeKlingOmniPromptReferences(params.payload.prompt).length;
    if (providerPromptLength > KLING_PROVIDER_PROMPT_MAX_CHARS) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'prompt',
          message: `Kling prompts must be at most ${KLING_PROVIDER_PROMPT_MAX_CHARS} characters after media references are normalized.`,
          allowed: [KLING_PROVIDER_PROMPT_MAX_CHARS],
          value: providerPromptLength,
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
