import type { Mode } from '../../../../fixtures/engineCaps';
import { ENGINE_CAPS, resolveEngineCapsKey, type EngineCapsKey } from '../../../../fixtures/engineCaps';
import { listFalEngines } from '../../../../src/config/falEngines';
import { validateModeMediaInputs } from './validate-media-inputs';
import { validateProviderSpecificConstraints } from './validate-provider-constraints';
import { validateProviderControls } from './validate-provider-controls';
import type { ValidationResult } from './validate-types';

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

function normalizeDurationValue(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return undefined;
}

export function validateRequest(engineId: string, mode: Mode | undefined, payload: Record<string, unknown>): ValidationResult {
  const capsKey: EngineCapsKey | undefined = resolveEngineCapsKey(engineId, mode);
  if (!capsKey) {
    return {
      ok: false,
      error: { code: 'ENGINE_UNKNOWN', message: 'Unsupported engine' },
    };
  }

  const caps = ENGINE_CAPS[capsKey];
  if (!caps) {
    return {
      ok: false,
      error: { code: 'ENGINE_UNKNOWN', message: 'Unsupported engine' },
    };
  }

  const normalizedMode: Mode = mode ?? 't2v';
  const promptMaxChars = ENGINE_INPUT_LIMITS[engineId]?.promptMaxChars;
  const rawPrompt = typeof payload['prompt'] === 'string' ? payload['prompt'] : '';
  const hasMultiPrompt =
    Array.isArray(payload['multi_prompt']) &&
    payload['multi_prompt'].some((entry) => entry && typeof entry === 'object' && typeof (entry as { prompt?: unknown }).prompt === 'string');

  if (ENGINE_REQUIRED_PROMPT_MODES[engineId]?.includes(normalizedMode) && !rawPrompt.trim() && !hasMultiPrompt) {
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

  const mediaInputValidation = validateModeMediaInputs({ engineId, normalizedMode, payload });
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
    const duration = normalizeDurationValue(payload['duration'] ?? payload['duration_seconds']);
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
      const matches = allowed.some((value) => {
        if (typeof value === 'number') {
          const numericDuration = typeof duration === 'number' ? duration : Number(String(duration).replace(/[^\d.]/g, ''));
          return numericDuration === value;
        }
        const durationString = String(duration);
        if (durationString === value) return true;
        const numericPortion = Number(String(value).replace(/[^\d.]/g, ''));
        if (Number.isFinite(numericPortion) && typeof duration === 'number') {
          return Math.round(duration) === Math.round(numericPortion);
        }
        if (Number.isFinite(numericPortion) && typeof duration === 'string') {
          const durationNumeric = Number(duration.replace(/[^\d.]/g, ''));
          return Number.isFinite(durationNumeric) && Math.round(durationNumeric) === Math.round(numericPortion);
        }
        return false;
      });
      if (!matches) {
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
      if (typeof duration !== 'number') {
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
      if (duration < caps.duration.min) {
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
