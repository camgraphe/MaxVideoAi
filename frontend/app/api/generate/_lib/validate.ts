import type { Mode } from '../../../../fixtures/engineCaps';
import type { EngineInputSchema } from '@/types/engines';
import type { ReferenceBudgetMediaItem, ReferenceBudgetValuesByField } from '@/lib/reference-budget';
import { ENGINE_CAPS, resolveEngineCapsKey, type EngineCapsKey } from '../../../../fixtures/engineCaps';
import { listFalEngines } from '../../../../src/config/falEngines';
import {
  isVideoDurationSupported,
  normalizeVideoDurationOption,
} from '../../../../src/server/video-generation/execution-constraints';
import type { ReferenceProvenanceIssue } from './attachment-references';
import { validateModeMediaInputs } from './validate-media-inputs';
import { validateProviderSpecificConstraints } from './validate-provider-constraints';
import { validateProviderControls } from './validate-provider-controls';
import { getVideoSchemaControlConstraintViolation } from '@/lib/video-input-schema';
import type { ValidationResult } from './validate-types';
import { deriveRuntimeSchemaCaps } from './runtime-schema-options';
export type RequestValidationContext = { inputSchema?: EngineInputSchema | null; referenceValuesByField?: ReferenceBudgetValuesByField<string>; referenceMediaItems?: readonly ReferenceBudgetMediaItem[]; referenceProvenanceIssues?: readonly ReferenceProvenanceIssue[] };
const ENGINE_INPUT_LIMITS = listFalEngines().reduce<Record<string, { promptMaxChars?: number }>>((acc, entry) => {
  acc[entry.id] = { promptMaxChars: entry.engine.inputLimits.promptMaxChars };
  return acc;
}, {});

const ENGINE_REQUIRED_PROMPT_MODES = listFalEngines().reduce<Record<string, Mode[]>>((acc, entry) => {
  const requiredPromptFields = (entry.engine.inputSchema?.required ?? []).filter((field) => field.id === 'prompt');
  const modes = new Set<Mode>();
  requiredPromptFields.forEach((field) => {
    (field.requiredInModes ?? []).forEach((mode) => modes.add(mode));
  });
  if (modes.size) {
    acc[entry.id] = Array.from(modes);
  }
  return acc;
}, {});

export function validateRequest(engineId: string, mode: Mode | undefined, payload: Record<string, unknown>, context: RequestValidationContext = {}): ValidationResult {
  const capsKey: EngineCapsKey | undefined = resolveEngineCapsKey(engineId, mode);
  const normalizedMode: Mode = mode ?? 't2v';
  const caps = (capsKey ? ENGINE_CAPS[capsKey] : undefined)
    ?? deriveRuntimeSchemaCaps(context.inputSchema, normalizedMode);
  if (!caps) {
    return {
      ok: false,
      error: { code: 'ENGINE_UNKNOWN', message: 'Unsupported engine' },
    };
  }

  const promptMaxChars = ENGINE_INPUT_LIMITS[engineId]?.promptMaxChars;
  const rawPrompt = typeof payload['prompt'] === 'string' ? payload['prompt'] : '';
  const hasMultiPrompt =
    Array.isArray(payload['multi_prompt']) &&
    payload['multi_prompt'].some((entry) => entry && typeof entry === 'object' && typeof (entry as { prompt?: unknown }).prompt === 'string');

  const schemaRequiresPrompt = !capsKey && (context.inputSchema?.required ?? []).some((field) => (
    field.id === 'prompt'
    && (
      field.requiredInModes?.includes(normalizedMode)
      || (!field.requiredInModes?.length && (!field.modes?.length || field.modes.includes(normalizedMode)))
    )
  ));
  if (
    (ENGINE_REQUIRED_PROMPT_MODES[engineId]?.includes(normalizedMode) || schemaRequiresPrompt)
    && !rawPrompt.trim()
    && !hasMultiPrompt
  ) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'prompt',
        message: 'Prompt is required for this engine mode',
      },
    };
  }

  if (typeof promptMaxChars === 'number' && promptMaxChars > 0 && rawPrompt.length > promptMaxChars && !hasMultiPrompt) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'prompt',
        message: `Prompt must be at most ${promptMaxChars} characters`,
        allowed: [promptMaxChars],
        value: rawPrompt.length,
      },
    };
  }

  const mediaInputValidation = validateModeMediaInputs({ engineId, normalizedMode, payload, inputSchema: context.inputSchema, referenceValuesByField: context.referenceValuesByField, referenceMediaItems: context.referenceMediaItems, referenceProvenanceIssues: context.referenceProvenanceIssues });
  if (!mediaInputValidation.ok) {
    return mediaInputValidation;
  }

  const providerSpecificValidation = validateProviderSpecificConstraints({ engineId, normalizedMode, payload });
  if (!providerSpecificValidation.ok) {
    return providerSpecificValidation;
  }

  const providerControlsValidation = validateProviderControls(payload);
  if (!providerControlsValidation.ok) {
    return providerControlsValidation;
  }

  const schemaControlViolation = getVideoSchemaControlConstraintViolation({
    inputSchema: context.inputSchema,
    duration: payload['duration'] ?? payload['duration_seconds'],
    resolution: payload['resolution'],
    fps: payload['fps'],
  });
  if (schemaControlViolation) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: schemaControlViolation.field,
        message: `Duration must be at most ${schemaControlViolation.maxDurationSec}s for these settings`,
        allowed: [`<= ${schemaControlViolation.maxDurationSec}`],
        value: payload['duration'] ?? payload['duration_seconds'],
      },
    };
  }

  if (caps.frames) {
    const frames = payload['num_frames'];
    if (typeof frames !== 'number' || !caps.frames.includes(frames)) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'num_frames',
          message: `Frames must be one of ${caps.frames.join(', ')}`,
          allowed: caps.frames,
          value: frames,
        },
      };
    }
    if ('duration' in payload || 'duration_seconds' in payload) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'duration',
          message: 'Duration not supported by this engine',
        },
      };
    }
  } else if (caps.duration) {
    const rawDuration = payload['duration'] ?? payload['duration_seconds'];
    const duration = normalizeVideoDurationOption(rawDuration);
    if (duration == null) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'duration',
          message: 'Duration is required for this engine',
          value: duration,
        },
      };
    }

    if ('options' in caps.duration) {
      const allowed = caps.duration.options;
      if (!isVideoDurationSupported(rawDuration, caps.duration)) {
        return {
          ok: false,
          error: {
            code: 'ENGINE_CONSTRAINT',
            field: 'duration',
            message: `Duration must be one of ${allowed.join(', ')}`,
            allowed: allowed,
            value: duration,
          },
        };
      }
    } else if ('min' in caps.duration) {
      if (!isVideoDurationSupported(rawDuration, caps.duration)) {
        return {
          ok: false,
          error: {
            code: 'ENGINE_CONSTRAINT',
            field: 'duration',
            message: `Duration must be ≥ ${caps.duration.min}s`,
            allowed: [`>= ${caps.duration.min}`],
            value: duration,
          },
        };
      }
    }
  } else if ('duration' in payload || 'duration_seconds' in payload) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'duration',
        message: 'Duration not supported by this engine',
        value: payload['duration'] ?? payload['duration_seconds'],
      },
    };
  }

  if (caps.resolution) {
    const resolution = payload['resolution'];
    if (typeof resolution === 'string' && !caps.resolution.includes(resolution)) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'resolution',
          message: `Resolution must be one of ${caps.resolution.join(', ')}`,
          allowed: caps.resolution,
          value: resolution,
        },
      };
    }
  } else if ('resolution' in payload) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'resolution',
        message: 'Resolution not supported by this engine',
        value: payload['resolution'],
      },
    };
  }

  if (caps.aspectRatio) {
    const aspect = payload['aspect_ratio'];
    if (typeof aspect === 'string' && !caps.aspectRatio.includes(aspect)) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'aspect_ratio',
          message: `Aspect ratio must be one of ${caps.aspectRatio.join(', ')}`,
          allowed: caps.aspectRatio,
          value: aspect,
        },
      };
    }
  } else if ('aspect_ratio' in payload) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'aspect_ratio',
        message: 'Aspect ratio not supported by this engine',
        value: payload['aspect_ratio'],
      },
    };
  }

  const audioFlag = payload['generate_audio'] ?? payload['audio'];
  if (audioFlag !== undefined && !caps.audioToggle) {
    return {
      ok: false,
      error: {
        code: 'ENGINE_CONSTRAINT',
        field: 'generate_audio',
        message: 'Audio toggle not supported by this engine',
        value: audioFlag,
      },
    };
  }

  const uploadedMb = payload['_uploadedFileMB'];
  if (caps.maxUploadMB && typeof uploadedMb === 'number') {
    if (uploadedMb > caps.maxUploadMB) {
      const uploadField =
        normalizedMode === 'r2v'
          ? 'video_urls'
          : normalizedMode === 'v2v' || normalizedMode === 'reframe' || normalizedMode === 'extend' || normalizedMode === 'retake'
            ? 'video_url'
          : normalizedMode === 'a2v'
            ? 'audio_url'
            : 'image_url';
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: uploadField,
          message: `Max upload is ${caps.maxUploadMB}MB`,
          allowed: [caps.maxUploadMB],
          value: uploadedMb,
        },
      };
    }
  }

  return { ok: true };
}
