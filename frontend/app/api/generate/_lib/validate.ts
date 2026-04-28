import type { Mode } from '../../../../fixtures/engineCaps';
import { ENGINE_CAPS, resolveEngineCapsKey, type EngineCapsKey } from '../../../../fixtures/engineCaps';
import { listFalEngines } from '../../../../src/config/falEngines';

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

type Ref2vLimits = {
  imageFieldId: string;
  imageRequired: boolean;
  maxImageCount: number;
  videoFieldId?: string;
  maxVideoCount?: number;
  audioFieldId?: string;
  maxAudioCount?: number;
};

const ENGINE_REF2V_LIMITS = listFalEngines().reduce<Record<string, Ref2vLimits>>((acc, entry) => {
  const requiredFields = entry.engine.inputSchema?.required ?? [];
  const optionalFields = entry.engine.inputSchema?.optional ?? [];
  const fields = [...requiredFields, ...optionalFields];
  const findField = (type: 'image' | 'video' | 'audio', ids: string[]) =>
    fields.find((field) => field.type === type && field.modes?.includes('ref2v') && ids.includes(field.id));

  const imageField = findField('image', ['image_urls', 'reference_image_urls']);
  if (!imageField) {
    return acc;
  }

  const videoField = findField('video', ['video_urls', 'reference_video_urls']);
  const audioField = findField('audio', ['audio_urls', 'reference_audio_urls']);
  acc[entry.id] = {
    imageFieldId: imageField.id,
    imageRequired:
      requiredFields.includes(imageField) || Boolean(imageField.requiredInModes?.includes('ref2v')),
    maxImageCount: imageField.maxCount ?? 4,
    videoFieldId: videoField?.id,
    maxVideoCount: videoField?.maxCount,
    audioFieldId: audioField?.id,
    maxAudioCount: audioField?.maxCount,
  };
  return acc;
}, {});

type V2vReferenceImageLimits = {
  imageFieldId: string;
  maxImageCount: number;
};

const ENGINE_V2V_REFERENCE_IMAGE_LIMITS = listFalEngines().reduce<Record<string, V2vReferenceImageLimits>>(
  (acc, entry) => {
    const fields = [...(entry.engine.inputSchema?.required ?? []), ...(entry.engine.inputSchema?.optional ?? [])];
    const imageField = fields.find(
      (field) => field.type === 'image' && field.modes?.includes('v2v') && field.id === 'reference_image_urls'
    );
    if (imageField) {
      acc[entry.id] = {
        imageFieldId: imageField.id,
        maxImageCount: imageField.maxCount ?? 5,
      };
    }
    return acc;
  },
  {}
);

function normalizeDurationValue(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return undefined;
}

function validateKlingElements(payload: Record<string, unknown>): ValidationResult {
  const rawElements = payload['elements'];
  if (!Array.isArray(rawElements)) {
    return { ok: true };
  }

  for (let index = 0; index < rawElements.length; index += 1) {
    const rawEntry = rawElements[index];
    if (!rawEntry || typeof rawEntry !== 'object') {
      continue;
    }

    const entry = rawEntry as Record<string, unknown>;
    const frontalImageUrl =
      typeof entry.frontalImageUrl === 'string' && entry.frontalImageUrl.trim().length
        ? entry.frontalImageUrl.trim()
        : typeof entry.frontal_image_url === 'string' && entry.frontal_image_url.trim().length
          ? entry.frontal_image_url.trim()
          : '';
    const referenceImageUrlsRaw = Array.isArray(entry.referenceImageUrls)
      ? entry.referenceImageUrls
      : Array.isArray(entry.reference_image_urls)
        ? entry.reference_image_urls
        : [];
    const referenceImageUrls = referenceImageUrlsRaw
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);
    const videoUrl =
      typeof entry.videoUrl === 'string' && entry.videoUrl.trim().length
        ? entry.videoUrl.trim()
        : typeof entry.video_url === 'string' && entry.video_url.trim().length
          ? entry.video_url.trim()
          : '';

    if (!frontalImageUrl && referenceImageUrls.length === 0 && !videoUrl) {
      continue;
    }

    const hasImageSet = Boolean(frontalImageUrl && referenceImageUrls.length > 0);
    const hasVideoReference = Boolean(videoUrl);
    if (!hasImageSet && !hasVideoReference) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'elements',
          message: `Kling element ${index + 1} needs a frontal image plus at least one reference image, or one video reference.`,
        },
      };
    }
  }

  return { ok: true };
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

  if (engineId.startsWith('kling-3') && normalizedMode === 'i2v') {
    const klingElementsValidation = validateKlingElements(payload);
    if (!klingElementsValidation.ok) {
      return klingElementsValidation;
    }
  }

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

  if (normalizedMode === 'v2v' || normalizedMode === 'reframe' || normalizedMode === 'extend' || normalizedMode === 'retake') {
    const sourceVideo =
      typeof payload['video_url'] === 'string' && payload['video_url'].trim().length
        ? payload['video_url'].trim()
        : Array.isArray(payload['video_urls'])
          ? payload['video_urls'].find((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : typeof payload['video_urls'] === 'string' && payload['video_urls'].trim().length
            ? payload['video_urls'].trim()
            : '';
    if (!sourceVideo) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'video_url',
          message: 'A source video is required for this engine mode',
        },
      };
    }

    const imageLimits = ENGINE_V2V_REFERENCE_IMAGE_LIMITS[engineId];
    if (imageLimits) {
      const rawImages = payload[imageLimits.imageFieldId];
      const images = Array.isArray(rawImages)
        ? rawImages.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
        : typeof rawImages === 'string' && rawImages.trim().length
          ? [rawImages.trim()]
          : [];
      if (images.length > imageLimits.maxImageCount) {
        return {
          ok: false,
          error: {
            code: 'ENGINE_CONSTRAINT',
            field: imageLimits.imageFieldId,
            message: `Up to ${imageLimits.maxImageCount} reference images are supported`,
            allowed: [0, imageLimits.maxImageCount],
            value: images.length,
          },
        };
      }
    }
  }

  if (normalizedMode === 'fl2v') {
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
    if (firstFrame === lastFrame) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'last_frame_url',
          message: 'First and last frames must be different images',
        },
      };
    }
  } else if (normalizedMode === 'ref2v') {
    const configured = ENGINE_REF2V_LIMITS[engineId] ?? {
      imageFieldId: 'image_urls',
      imageRequired: true,
      maxImageCount: 4,
      videoFieldId: 'video_urls',
      maxVideoCount: 3,
      audioFieldId: 'audio_urls',
      maxAudioCount: 3,
    };
    const normalizeImageArray = (raw: unknown): string[] =>
      Array.isArray(raw)
        ? raw.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
        : typeof raw === 'string' && raw.trim().length
          ? [raw.trim()]
          : [];
    const referenceImageUrls = normalizeImageArray(payload['reference_image_urls']);
    const genericImageUrls = normalizeImageArray(payload['image_urls']);
    const referenceVideoUrls = normalizeImageArray(payload['reference_video_urls']);
    const genericVideoUrls = normalizeImageArray(payload['video_urls']);
    const referenceAudioUrls = normalizeImageArray(payload['reference_audio_urls']);
    const genericAudioUrls = normalizeImageArray(payload['audio_urls']);
    const imageUrls = referenceImageUrls.length ? referenceImageUrls : genericImageUrls;
    const videoUrls = referenceVideoUrls.length ? referenceVideoUrls : genericVideoUrls;
    const audioUrls = referenceAudioUrls.length ? referenceAudioUrls : genericAudioUrls;
    const imageFieldId =
      referenceImageUrls.length ||
      payload['reference_image_urls'] !== undefined ||
      configured.imageFieldId === 'reference_image_urls'
        ? 'reference_image_urls'
        : 'image_urls';
    const videoFieldId =
      referenceVideoUrls.length ||
      payload['reference_video_urls'] !== undefined ||
      configured.videoFieldId === 'reference_video_urls'
        ? 'reference_video_urls'
        : 'video_urls';
    const audioFieldId =
      referenceAudioUrls.length ||
      payload['reference_audio_urls'] !== undefined ||
      configured.audioFieldId === 'reference_audio_urls'
        ? 'reference_audio_urls'
        : 'audio_urls';
    if (configured.imageRequired && !imageUrls.length) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: imageFieldId,
          message: 'Reference images are required for this engine mode',
        },
      };
    }
    if (imageUrls.length > configured.maxImageCount) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: imageFieldId,
          message: `Up to ${configured.maxImageCount} reference images are supported`,
          allowed: [1, configured.maxImageCount],
          value: imageUrls.length,
        },
      };
    }
    if (typeof configured.maxVideoCount === 'number' && videoUrls.length > configured.maxVideoCount) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: videoFieldId,
          message: `Up to ${configured.maxVideoCount} reference videos are supported`,
          allowed: [1, configured.maxVideoCount],
          value: videoUrls.length,
        },
      };
    }
    if (typeof configured.maxAudioCount === 'number' && audioUrls.length > configured.maxAudioCount) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: audioFieldId,
          message: `Up to ${configured.maxAudioCount} reference audio files are supported`,
          allowed: [1, configured.maxAudioCount],
          value: audioUrls.length,
        },
      };
    }
    if (audioUrls.length && imageUrls.length === 0 && videoUrls.length === 0) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: audioFieldId,
          message: 'Reference audio requires at least one reference image or reference video',
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

  if (normalizedMode === 'a2v') {
    const audioUrl =
      typeof payload['audio_url'] === 'string' && payload['audio_url'].trim().length ? payload['audio_url'].trim() : null;
    if (!audioUrl) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'audio_url',
          message: 'Audio URL is required for this engine mode',
        },
      };
    }
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
