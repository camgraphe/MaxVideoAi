import type { Mode } from '../../../../fixtures/engineCaps';
import { ENGINE_CAPS, resolveEngineCapsKey, type EngineCapsKey } from '../../../../fixtures/engineCaps';

type ValidationError = {
  code: string;
  message: string;
  field?: string;
  allowed?: Array<string | number>;
  value?: unknown;
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

  const normalizedMode: Mode = mode ?? 't2v';

  if (normalizedMode === 'r2v') {
    const rawVideos = payload['video_urls'];
    const videos = Array.isArray(rawVideos)
      ? rawVideos.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
      : typeof rawVideos === 'string' && rawVideos.trim().length
        ? [rawVideos.trim()]
        : [];
    if (!videos.length) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'video_urls',
          message: 'Reference videos are required for this engine mode',
        },
      };
    }
    if (videos.length > 3) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'video_urls',
          message: 'Up to 3 reference videos are supported',
          allowed: [1, 3],
          value: videos.length,
        },
      };
    }
  }

  if (engineId === 'veo-3-1-first-last' && (normalizedMode === 'i2v' || normalizedMode === 'i2i')) {
    const firstFrame = typeof payload['first_frame_url'] === 'string' ? payload['first_frame_url'].trim() : '';
    if (!firstFrame) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'first_frame_url',
          message: 'First frame is required for this engine',
        },
      };
    }
    const lastFrame = typeof payload['last_frame_url'] === 'string' ? payload['last_frame_url'].trim() : '';
    if (!lastFrame) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'last_frame_url',
          message: 'Last frame is required for this engine',
        },
      };
    }
  } else if (normalizedMode === 'i2v' || normalizedMode === 'i2i') {
    const imageUrl =
      typeof payload['image_url'] === 'string' && payload['image_url'].trim().length ? payload['image_url'].trim() : null;
    if (!imageUrl) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'image_url',
          message: 'Image URL is required for this engine mode',
        },
      };
    }
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
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: normalizedMode === 'r2v' ? 'video_urls' : 'image_url',
          message: `Max upload is ${caps.maxUploadMB}MB`,
          allowed: [caps.maxUploadMB],
          value: uploadedMb,
        },
      };
    }
  }

  return { ok: true };
}
