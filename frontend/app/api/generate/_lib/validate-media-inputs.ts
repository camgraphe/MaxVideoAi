import type { Mode } from '../../../../fixtures/engineCaps';
import { listFalEngines } from '../../../../src/config/falEngines';
import type { ValidationResult } from './validate-types';

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
  if (!imageField) return acc;

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

function normalizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)
    : typeof raw === 'string' && raw.trim().length
      ? [raw.trim()]
      : [];
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

    if (!frontalImageUrl && referenceImageUrls.length === 0 && !videoUrl) continue;

    const hasImageSet = Boolean(frontalImageUrl && referenceImageUrls.length > 0);
    const hasVideoReference = Boolean(videoUrl);
    if (!hasImageSet && !hasVideoReference) {
      return {
        ok: false,
        error: {
          code: 'ENGINE_CONSTRAINT',
          field: 'elements',
          message: `Subject reference ${index + 1} needs a frontal image plus at least one reference image, or one video reference.`,
        },
      };
    }
  }

  return { ok: true };
}

export function validateModeMediaInputs(params: {
  engineId: string;
  normalizedMode: Mode;
  payload: Record<string, unknown>;
}): ValidationResult {
  const { engineId, normalizedMode, payload } = params;

  if (engineId.startsWith('kling-3') && normalizedMode === 'i2v') {
    const klingElementsValidation = validateKlingElements(payload);
    if (!klingElementsValidation.ok) return klingElementsValidation;
  }

  if (normalizedMode === 'r2v') {
    const videos = normalizeStringArray(payload['video_urls']);
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
        : normalizeStringArray(payload['video_urls'])[0] ?? '';
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
      const images = normalizeStringArray(payload[imageLimits.imageFieldId]);
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
    const lastFrame = typeof payload['last_frame_url'] === 'string' ? payload['last_frame_url'].trim() : '';
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
    return validateRef2vInputs(engineId, payload);
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

  return { ok: true };
}

function validateRef2vInputs(engineId: string, payload: Record<string, unknown>): ValidationResult {
  const configured = ENGINE_REF2V_LIMITS[engineId] ?? {
    imageFieldId: 'image_urls',
    imageRequired: true,
    maxImageCount: 4,
    videoFieldId: 'video_urls',
    maxVideoCount: 3,
    audioFieldId: 'audio_urls',
    maxAudioCount: 3,
  };
  const referenceImageUrls = normalizeStringArray(payload['reference_image_urls']);
  const genericImageUrls = normalizeStringArray(payload['image_urls']);
  const referenceVideoUrls = normalizeStringArray(payload['reference_video_urls']);
  const genericVideoUrls = normalizeStringArray(payload['video_urls']);
  const referenceAudioUrls = normalizeStringArray(payload['reference_audio_urls']);
  const genericAudioUrls = normalizeStringArray(payload['audio_urls']);
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
  return { ok: true };
}
