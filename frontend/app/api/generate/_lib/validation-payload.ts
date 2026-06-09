import type { MaxVideoProviderElement } from '@/lib/video-provider-elements';
import type { Mode } from '@/types/engines';
import { validateRequest } from './validate';

type GenerateValidationMetric = {
  errorCode: string;
  meta?: Record<string, unknown>;
};

type GenerateValidationDeps = {
  validateRequestFn?: typeof validateRequest;
};

export type GenerateValidationPayloadResult =
  | {
      ok: true;
      payload: Record<string, unknown>;
      needsImage: boolean;
      needsReferenceImages: boolean;
      needsFirstLastFrames: boolean;
      needsAudio: boolean;
      needsSourceVideoEdit: boolean;
    }
  | {
      ok: false;
      status: number;
      body: Record<string, unknown>;
      metric: GenerateValidationMetric;
    };

export function buildGenerateValidationPayload(params: {
  engineId: string;
  mode: Mode;
  prompt: string;
  multiPrompt: Array<{ prompt: string; duration: number }> | null;
  supportsResolution: boolean;
  effectiveResolution: string;
  supportsAspectRatio: boolean;
  aspectRatio: string | null;
  audioEnabled: boolean | undefined;
  isBytePlusV1a: boolean;
  supportsDuration: boolean;
  numFrames: number | null;
  validationDuration: number | string | null;
  maxUploadedBytes: number;
  resolvedFirstFrameUrl: string | null | undefined;
  lastFrameUrl: string | null | undefined;
  normalizedReferenceImages: string[];
  videoUrls: string[];
  audioUrls: string[];
  resolvedAudioUrl: string | null | undefined;
  sourceInputVideoUrl: string | null | undefined;
  elements: MaxVideoProviderElement[] | null;
  endImageUrl: string | null | undefined;
  startImageUrl: string | null | undefined;
  isLumaRay2: boolean;
  initialImageUrl: string | null | undefined;
  deps?: GenerateValidationDeps;
}): GenerateValidationPayloadResult {
  const validateRequestFn = params.deps?.validateRequestFn ?? validateRequest;
  const payload: Record<string, unknown> = {};

  if (params.prompt.length > 0) {
    payload.prompt = params.prompt;
  }
  if (params.multiPrompt?.length) {
    payload.multi_prompt = params.multiPrompt;
  }
  if (params.supportsResolution) {
    payload.resolution = params.effectiveResolution;
  }
  if (params.supportsAspectRatio && params.aspectRatio) {
    payload.aspect_ratio = params.aspectRatio;
  }
  if (typeof params.audioEnabled === 'boolean' && !params.isBytePlusV1a) {
    payload.generate_audio = params.audioEnabled;
  }

  if (params.supportsDuration) {
    if (params.numFrames != null) {
      payload.num_frames = params.numFrames;
    } else if (params.validationDuration != null) {
      payload.duration = params.validationDuration;
    }
  }

  if (params.maxUploadedBytes > 0) {
    payload._uploadedFileMB = params.maxUploadedBytes / (1024 * 1024);
  }

  if (params.resolvedFirstFrameUrl) {
    payload.first_frame_url = params.resolvedFirstFrameUrl;
  }
  if (params.lastFrameUrl) {
    payload.last_frame_url = params.lastFrameUrl;
  }
  if (params.mode === 'ref2v' && params.normalizedReferenceImages.length) {
    payload.image_urls = params.normalizedReferenceImages;
  }
  if (params.mode === 'ref2v' && params.videoUrls.length) {
    payload.video_urls = params.videoUrls;
  }
  if (params.mode === 'ref2v') {
    const refAudioUrls = Array.from(new Set([...(params.resolvedAudioUrl ? [params.resolvedAudioUrl] : []), ...params.audioUrls]));
    if (refAudioUrls.length) {
      payload.audio_urls = refAudioUrls;
    }
  }
  if (params.mode === 'v2v' && params.normalizedReferenceImages.length) {
    if (params.engineId.startsWith('kling-o3')) {
      payload.image_urls = params.normalizedReferenceImages;
    } else {
      payload.reference_image_urls = params.normalizedReferenceImages;
    }
  }
  if (params.mode === 'r2v' && params.videoUrls.length) {
    payload.video_urls = params.videoUrls;
  }
  if (isSourceVideoEditMode(params.mode) && params.sourceInputVideoUrl) {
    payload.video_url = params.sourceInputVideoUrl;
  }
  if (params.resolvedAudioUrl) {
    payload.audio_url = params.resolvedAudioUrl;
  }
  if (params.elements?.length) {
    payload.elements = params.elements;
  }
  if (params.mode === 'ref2v' && params.startImageUrl) {
    payload.start_image_url = params.startImageUrl;
  }
  if (params.mode === 'i2v' && params.endImageUrl) {
    payload.end_image_url = params.endImageUrl;
  } else if (params.mode === 'ref2v' && params.endImageUrl) {
    payload.end_image_url = params.endImageUrl;
  }

  const needsImage = params.mode === 'i2v' || params.mode === 'i2i';
  const needsReferenceImages = params.mode === 'ref2v';
  const needsFirstLastFrames = params.mode === 'fl2v';
  const needsAudio = params.mode === 'a2v';
  const needsSourceVideoEdit = isSourceVideoEditMode(params.mode);

  const requiredInputError = validateRequiredInputs({
    engineId: params.engineId,
    mode: params.mode,
    isLumaRay2: params.isLumaRay2,
    isBytePlusV1a: params.isBytePlusV1a,
    needsImage,
    needsReferenceImages,
    needsFirstLastFrames,
    needsAudio,
    needsSourceVideoEdit,
    initialImageUrl: params.initialImageUrl,
    resolvedFirstFrameUrl: params.resolvedFirstFrameUrl,
    lastFrameUrl: params.lastFrameUrl,
    normalizedReferenceImages: params.normalizedReferenceImages,
    videoUrls: params.videoUrls,
    sourceInputVideoUrl: params.sourceInputVideoUrl,
    resolvedAudioUrl: params.resolvedAudioUrl,
    startImageUrl: params.startImageUrl,
    endImageUrl: params.endImageUrl,
  });
  if (requiredInputError) {
    return requiredInputError;
  }

  if (params.isLumaRay2 && params.mode === 'i2v') {
    payload.image_url = params.initialImageUrl;
  } else if (needsImage) {
    payload.image_url = params.initialImageUrl;
  } else if ((params.mode === 'v2v' || params.mode === 'reframe') && params.initialImageUrl) {
    payload.image_url = params.initialImageUrl;
  }

  const validationResult = validateRequestFn(params.engineId, params.mode, payload);
  if (!validationResult.ok) {
    return {
      ok: false,
      status: 400,
      metric: {
        errorCode: validationResult.error.code ?? 'ENGINE_CONSTRAINT',
        meta: {
          field: validationResult.error.field,
          allowed: validationResult.error.allowed,
          value: validationResult.error.value,
        },
      },
      body: {
        ok: false,
        error: validationResult.error.code ?? 'ENGINE_CONSTRAINT',
        message: validationResult.error.message,
        field: validationResult.error.field,
        allowed: validationResult.error.allowed,
        value: validationResult.error.value,
      },
    };
  }

  return {
    ok: true,
    payload,
    needsImage,
    needsReferenceImages,
    needsFirstLastFrames,
    needsAudio,
    needsSourceVideoEdit,
  };
}

function isSourceVideoEditMode(mode: Mode): boolean {
  return mode === 'v2v' || mode === 'reframe' || mode === 'extend' || mode === 'retake';
}

function validateRequiredInputs(params: {
  engineId: string;
  mode: Mode;
  isLumaRay2: boolean;
  isBytePlusV1a: boolean;
  needsImage: boolean;
  needsReferenceImages: boolean;
  needsFirstLastFrames: boolean;
  needsAudio: boolean;
  needsSourceVideoEdit: boolean;
  initialImageUrl: string | null | undefined;
  resolvedFirstFrameUrl: string | null | undefined;
  lastFrameUrl: string | null | undefined;
  normalizedReferenceImages: string[];
  videoUrls: string[];
  sourceInputVideoUrl: string | null | undefined;
  resolvedAudioUrl: string | null | undefined;
  startImageUrl: string | null | undefined;
  endImageUrl: string | null | undefined;
}): Extract<GenerateValidationPayloadResult, { ok: false }> | null {
  if (params.isLumaRay2 && params.mode === 'i2v') {
    if (!params.initialImageUrl) {
      return missingInput('IMAGE_URL_REQUIRED', params, 'Image URL is required for Luma Ray 2 image-to-video');
    }
    return null;
  }
  if (params.needsImage) {
    if (!params.initialImageUrl) {
      return missingInput('IMAGE_URL_REQUIRED', params, 'Image URL is required for this engine mode');
    }
    return null;
  }
  if (params.needsReferenceImages) {
    if (params.engineId.startsWith('kling-o3') && params.mode === 'ref2v' && params.endImageUrl && !params.startImageUrl) {
      return missingInput(
        'START_IMAGE_URL_REQUIRED',
        params,
        'End frame requires a start frame for Kling 3.0 Omni reference-to-video.'
      );
    }
    const bytePlusHasAnyReference =
      params.isBytePlusV1a && (params.normalizedReferenceImages.length > 0 || params.videoUrls.length > 0);
    if (!params.normalizedReferenceImages.length && !bytePlusHasAnyReference) {
      return missingInput(
        'IMAGE_URL_REQUIRED',
        params,
        params.isBytePlusV1a
          ? 'At least one reference image or video is required for this engine mode'
          : 'Reference images are required for this engine mode'
      );
    }
    return null;
  }
  if (params.needsFirstLastFrames) {
    if (!params.resolvedFirstFrameUrl || !params.lastFrameUrl) {
      return missingInput('IMAGE_URL_REQUIRED', params, 'Both first and last frames are required for this engine mode');
    }
    return null;
  }
  if (params.mode === 'r2v') {
    if (!params.videoUrls.length) {
      return missingInput('VIDEO_URL_REQUIRED', params, 'Video URLs are required for this engine mode');
    }
    return null;
  }
  if (params.needsSourceVideoEdit) {
    if (!params.sourceInputVideoUrl) {
      return missingInput('VIDEO_URL_REQUIRED', params, 'Source video is required for this engine mode');
    }
    return null;
  }
  if (params.needsAudio && !params.resolvedAudioUrl) {
    return missingInput('AUDIO_URL_REQUIRED', params, 'Audio URL is required for this engine mode');
  }
  return null;
}

function missingInput(
  errorCode: string,
  params: { engineId: string; mode: Mode },
  message: string
): Extract<GenerateValidationPayloadResult, { ok: false }> {
  return {
    ok: false,
    status: 400,
    metric: {
      errorCode,
      meta: { engineId: params.engineId, mode: params.mode },
    },
    body: { ok: false, error: message },
  };
}
