import type { Mode } from '../../../../fixtures/engineCaps';
import { ENGINE_CAPS, resolveEngineCapsKey, type EngineCapsKey } from '../../../../fixtures/engineCaps';

type ValidationError = {
  code: string;
  message: string;
  field?: string;
};

type ValidationResult =
  | { ok: true }
  | { ok: false; error: ValidationError };

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

  if (caps.frames) {
    const frames = payload['num_frames'];
    if (typeof frames !== 'number' || !caps.frames.includes(frames)) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'num_frames',
          message: `Frames must be one of ${caps.frames.join(', ')}`,
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
      },
    };
  }

  const uploadedMb = payload['_uploadedFileMB'];
  if (caps.maxUploadMB && typeof uploadedMb === 'number') {
    if (uploadedMb > caps.maxUploadMB) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'image_url',
          message: `Max upload is ${caps.maxUploadMB}MB`,
        },
      };
    }
  }

  return { ok: true };
}
