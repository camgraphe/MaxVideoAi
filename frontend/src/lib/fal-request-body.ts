import {
  getLumaRay2DurationInfo,
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
  toLumaRay2DurationLabel,
} from '@/lib/luma-ray2';
import { normalizeFalDurationValueForModel, resolveFalVideoResolutionInput } from '@/lib/fal-model-helpers';
import { buildSoraFalInput } from '@/lib/sora';
import { stripKlingDirectOnlyExtraInputValues } from '@/lib/kling-direct-extra-values';
import { buildFalElementInputs } from '@/lib/video-provider-elements';
import type { GeneratePayload } from '@/lib/fal-types';

export function buildFalGenerationRequest(
  payload: GeneratePayload,
  defaultModel: string
): { model: string; requestBody: Record<string, unknown> } {
  let apiKey: string | undefined;
  if (payload.apiKey && payload.apiKey.trim().length > 10) {
    apiKey = payload.apiKey.trim();
  }

  const soraFal = payload.soraRequest ? buildSoraFalInput(payload.soraRequest) : null;
  let model = defaultModel;
  let requestBody: Record<string, unknown> = {};

  if (soraFal) {
    model = soraFal.model;
    requestBody = { ...soraFal.input };
    if (apiKey && !requestBody.api_key) {
      requestBody.api_key = apiKey;
    }
  } else {
    const resolution = resolveFalVideoResolutionInput(payload.engineId, payload.resolution);
    requestBody = {
      fps: payload.fps,
    };
    if (resolution) {
      requestBody.resolution = resolution;
    }
    if (payload.prompt.trim().length) {
      requestBody.prompt = payload.prompt;
    }
    if (payload.aspectRatio) {
      requestBody.aspect_ratio = payload.aspectRatio;
    }

    if (typeof payload.audio === 'boolean') {
      requestBody.generate_audio = payload.audio;
    }

    if (payload.audioUrl) {
      requestBody.audio_url = payload.audioUrl;
    }

    if (typeof payload.numFrames === 'number' && Number.isFinite(payload.numFrames) && payload.numFrames > 0) {
      requestBody.num_frames = Math.round(payload.numFrames);
    } else if (!isLumaRay2EngineId(payload.engineId)) {
      if (payload.durationOption != null) {
        requestBody.duration = normalizeFalDurationValueForModel(payload.engineId, model, payload.durationOption);
      } else if (payload.durationSec != null) {
        requestBody.duration = normalizeFalDurationValueForModel(payload.engineId, model, payload.durationSec);
      }
    }

    if (apiKey) {
      requestBody.api_key = apiKey;
    }
  }

  if (payload.multiPrompt && payload.multiPrompt.length) {
    requestBody.multi_prompt = payload.multiPrompt
      .filter((entry) => entry && typeof entry.prompt === 'string' && entry.prompt.trim().length)
      .map((entry) => ({
        prompt: entry.prompt,
        duration: String(Math.round(entry.duration || 0)),
      }));
  }
  if (payload.shotType) {
    requestBody.shot_type = payload.shotType;
  }
  if (typeof payload.seed === 'number' && Number.isFinite(payload.seed)) {
    requestBody.seed = Math.trunc(payload.seed);
  }
  if (typeof payload.cameraFixed === 'boolean') {
    requestBody.camera_fixed = payload.cameraFixed;
  }
  if (typeof payload.safetyChecker === 'boolean') {
    requestBody.enable_safety_checker = payload.safetyChecker;
  }
  if (payload.voiceIds && payload.voiceIds.length) {
    requestBody.voice_ids = payload.voiceIds;
  }
  const falElements = buildFalElementInputs(payload.elements);
  if (falElements) {
    requestBody.elements = falElements;
  }
  if (payload.endImageUrl) {
    requestBody.end_image_url = payload.endImageUrl;
  }

  if (isLumaRay2EngineId(payload.engineId) && isLumaRay2GenerateMode(payload.mode)) {
    const durationInfo = getLumaRay2DurationInfo(payload.durationOption ?? payload.durationSec);
    const durationLabel = durationInfo?.label ?? toLumaRay2DurationLabel(payload.durationSec) ?? '5s';
    requestBody.duration = durationLabel;
    if (payload.resolution) {
      requestBody.resolution = payload.resolution;
    }
    if (typeof payload.loop === 'boolean') {
      requestBody.loop = payload.loop;
    }
  }

  if (typeof payload.cfgScale === 'number') {
    requestBody.cfg_scale = payload.cfgScale;
  }

  const arrayCollectors = new Map<string, Set<string>>();
  const expectsSingleSourceVideo =
    payload.mode === 'v2v' || payload.mode === 'reframe' || payload.mode === 'extend' || payload.mode === 'retake';
  const expectsImageArray = payload.mode === 'ref2v';
  const expectsFirstLastFrames = payload.mode === 'fl2v';
  const forbidsPrimaryImage = payload.mode === 'ref2v';
  const addToArray = (key: string, value: string) => {
    if (!arrayCollectors.has(key)) {
      arrayCollectors.set(key, new Set());
    }
    arrayCollectors.get(key)!.add(value);
  };

  const attachments = payload.inputs ?? [];
  let primaryImageUrl = payload.imageUrl?.trim();
  let primaryAudioUrl = payload.audioUrl?.trim();

  for (const attachment of attachments) {
    const urlCandidate = attachment.url?.trim() ?? attachment.dataUrl?.trim();
    if (!urlCandidate) continue;

    if (!primaryImageUrl && attachment.kind === 'image') {
      primaryImageUrl = urlCandidate;
    }
    if (!primaryAudioUrl && attachment.kind === 'audio') {
      primaryAudioUrl = urlCandidate;
    }

    const slotId = attachment.slotId?.trim();
    if (
      slotId === 'reference_images' ||
      slotId === 'images' ||
      slotId === 'image_urls' ||
      slotId === 'reference_image_urls'
    ) {
      if (expectsImageArray) {
        addToArray('image_urls', urlCandidate);
      } else if (slotId === 'reference_images') {
        addToArray('reference_images', urlCandidate);
      } else if (slotId === 'reference_image_urls') {
        addToArray('reference_image_urls', urlCandidate);
      } else {
        addToArray(slotId === 'images' ? 'image_urls' : slotId, urlCandidate);
      }
      continue;
    }
    if (
      slotId === 'video_urls' ||
      slotId === 'video_url' ||
      slotId === 'reference_video_urls' ||
      slotId === 'reference_videos' ||
      slotId === 'videos'
    ) {
      if (expectsSingleSourceVideo) {
        if (!requestBody.video_url) {
          requestBody.video_url = urlCandidate;
        }
      } else {
        if (expectsImageArray && (slotId === 'reference_videos' || slotId === 'reference_video_urls')) {
          addToArray('video_urls', urlCandidate);
        } else if (slotId === 'reference_videos' || slotId === 'reference_video_urls') {
          addToArray('reference_video_urls', urlCandidate);
        } else {
          addToArray('video_urls', urlCandidate);
        }
      }
      continue;
    }
    if (
      slotId === 'audio_url' ||
      slotId === 'audio_urls' ||
      slotId === 'reference_audio_urls' ||
      slotId === 'reference_audios'
    ) {
      if (slotId === 'audio_url') {
        requestBody.audio_url = urlCandidate;
      } else if (expectsImageArray && (slotId === 'reference_audio_urls' || slotId === 'reference_audios')) {
        addToArray('audio_urls', urlCandidate);
      } else {
        addToArray(slotId === 'reference_audios' ? 'reference_audio_urls' : slotId, urlCandidate);
      }
      continue;
    }
    if (slotId === 'input_image' || slotId === 'image' || slotId === 'image_url') {
      if (expectsFirstLastFrames) {
        if (!requestBody.first_frame_url) {
          requestBody.first_frame_url = urlCandidate;
        }
        continue;
      }
      requestBody[slotId] = urlCandidate;
      continue;
    }
    if (slotId === 'first_frame_url' || slotId === 'last_frame_url' || slotId === 'end_image_url') {
      requestBody[slotId] = urlCandidate;
      continue;
    }
    if (!slotId && attachment.kind === 'image' && expectsImageArray) {
      addToArray('image_urls', urlCandidate);
      continue;
    }
    if (!slotId && attachment.kind === 'video') {
      if (expectsSingleSourceVideo) {
        if (!requestBody.video_url) {
          requestBody.video_url = urlCandidate;
        }
      } else {
        addToArray('video_urls', urlCandidate);
      }
      continue;
    }
    if (!slotId && attachment.kind === 'audio') {
      if (expectsImageArray) {
        addToArray('audio_urls', urlCandidate);
      } else if (!requestBody.audio_url) {
        requestBody.audio_url = urlCandidate;
      } else {
        addToArray('reference_audio_urls', urlCandidate);
      }
      continue;
    }
  }

  const referenceImages = payload.referenceImages ?? [];
  referenceImages.forEach((url) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (expectsImageArray) {
      addToArray('image_urls', trimmed);
      return;
    }
    if (expectsSingleSourceVideo && (payload.engineId === 'happy-horse-1-0' || requestBody.reference_image_urls)) {
      addToArray('reference_image_urls', trimmed);
      return;
    }
    addToArray('reference_images', trimmed);
  });

  for (const [key, values] of arrayCollectors.entries()) {
    requestBody[key] = Array.from(values);
  }

  if (!primaryImageUrl && !forbidsPrimaryImage && !expectsFirstLastFrames) {
    const referenceArray = requestBody.reference_images as string[] | undefined;
    if (referenceArray?.length) {
      primaryImageUrl = referenceArray[0];
    }
  }

  if (!requestBody.first_frame_url && primaryImageUrl && expectsFirstLastFrames) {
    requestBody.first_frame_url = primaryImageUrl;
  }
  if (!requestBody.image_url && primaryImageUrl && !forbidsPrimaryImage && !expectsFirstLastFrames) {
    requestBody.image_url = primaryImageUrl;
  }
  if (!requestBody.audio_url && primaryAudioUrl) {
    requestBody.audio_url = primaryAudioUrl;
  }
  if (!requestBody.input_image && primaryImageUrl && payload.engineId.startsWith('sora-2')) {
    requestBody.input_image = primaryImageUrl;
  }

  if (expectsSingleSourceVideo) {
    if (!requestBody.video_url) {
      const collected = requestBody.video_urls;
      const sourceVideo =
        Array.isArray(collected) && collected.length
          ? collected.find((value): value is string => typeof value === 'string' && value.trim().length > 0)
          : typeof collected === 'string' && collected.trim().length
            ? collected.trim()
            : undefined;
      if (sourceVideo) {
        requestBody.video_url = sourceVideo;
      }
    }
    delete requestBody.video_urls;
  }

  const extraInputValues = payload.engineId.startsWith('kling-3')
    ? stripKlingDirectOnlyExtraInputValues(payload.extraInputValues)
    : payload.extraInputValues;
  if (extraInputValues) {
    Object.entries(extraInputValues).forEach(([key, value]) => {
      if (value === undefined || value === null || key in requestBody) return;
      requestBody[key] = value;
    });
  }

  if (payload.engineId.startsWith('kling-3') && requestBody.image_url && !requestBody.start_image_url) {
    requestBody.start_image_url = requestBody.image_url;
    delete requestBody.image_url;
  }

  if (payload.engineId.startsWith('kling-3') && requestBody.multi_prompt && requestBody.prompt) {
    // Kling v3 expects prompt or multi_prompt, not both.
    delete requestBody.prompt;
  }

  const metadataPayload: Record<string, unknown> = {};
  if (payload.jobId) {
    metadataPayload.app_job_id = payload.jobId;
  }
  if (payload.localKey) {
    metadataPayload.app_local_key = payload.localKey;
  }
  if (Object.keys(metadataPayload).length) {
    const existing =
      requestBody.metadata && typeof requestBody.metadata === 'object' && !Array.isArray(requestBody.metadata)
        ? (requestBody.metadata as Record<string, unknown>)
        : {};
    requestBody.metadata = { ...existing, ...metadataPayload };
  }

  return { model, requestBody };
}
