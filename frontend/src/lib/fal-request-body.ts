import {
  getLumaRay2DurationInfo,
  isLumaRay2EngineId,
  isLumaRay2GenerateMode,
  toLumaRay2DurationLabel,
} from '@/lib/luma-ray2';
import { isLumaRay32EngineId, isLumaRay32PublicMode } from '@/lib/luma-agents';
import { normalizeFalDurationValueForModel, resolveFalVideoResolutionInput } from '@/lib/fal-model-helpers';
import { buildSoraFalInput } from '@/lib/sora';
import { stripKlingDirectOnlyExtraInputValues } from '@/lib/kling-direct-extra-values';
import { buildFalElementInputs } from '@/lib/video-provider-elements';
import { isHappyHorseFalModelId, supportsHappyHorseVideoEdit } from '@/lib/happy-horse-workflow';
import { buildMinimaxH3FalRequest, isMinimaxH3EngineId } from '@/lib/minimax-h3';
import type { GeneratePayload } from '@/lib/fal-types';
import type { Mode } from '@/types/engines';
import { getFalEngineById } from '@/config/falEngines';
import {
  projectVideoProviderFieldValue,
  resolveActiveVideoInputField,
  VIDEO_MEDIA_FIELD_CANDIDATES,
} from '@/lib/video-input-schema';

export function buildFalGenerationRequest(
  payload: GeneratePayload,
  defaultModel: string
): { model: string; requestBody: Record<string, unknown> } {
  if (isMinimaxH3EngineId(payload.engineId)) {
    return buildMinimaxH3FalRequest(payload);
  }

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
    const inputSchema = getFalEngineById(payload.engineId)?.engine.inputSchema;
    const activeField = (
      candidateFieldIds: readonly string[],
      type?: 'image' | 'video' | 'audio' | 'enum' | 'boolean' | 'number',
    ) => resolveActiveVideoInputField({
      inputSchema,
      mode: (payload.mode ?? 't2v') as Mode,
      candidateFieldIds,
      type,
    });
    const schemaAware = Boolean(inputSchema);
    const resolution = resolveFalVideoResolutionInput(payload.engineId, payload.resolution, model, payload.mode);
    requestBody = {};
    if (
      !isHappyHorseFalModelId(model)
      && typeof payload.fps === 'number'
      && Number.isFinite(payload.fps)
      && (!schemaAware || activeField(['fps']))
    ) {
      requestBody.fps = payload.fps;
    }
    const resolutionField = activeField(['resolution']);
    if (resolution && (!schemaAware || resolutionField)) {
      requestBody.resolution = projectVideoProviderFieldValue(resolutionField, resolution);
    }
    if (payload.prompt.trim().length) {
      requestBody.prompt = payload.prompt;
    }
    const shouldSendAspectRatio = !(isHappyHorseFalModelId(model) && payload.mode === 'i2v');
    const aspectRatioField = activeField(['aspect_ratio']);
    if (payload.aspectRatio && shouldSendAspectRatio && (!schemaAware || aspectRatioField)) {
      requestBody.aspect_ratio = projectVideoProviderFieldValue(aspectRatioField, payload.aspectRatio);
    }

    const isKlingO3VideoToVideo = payload.engineId.startsWith('kling-o3') && payload.mode === 'v2v';
    const audioToggleField = activeField(['generate_audio', 'audio']);
    if (
      typeof payload.audio === 'boolean'
      && !isKlingO3VideoToVideo
      && (!schemaAware || audioToggleField)
    ) {
      requestBody[audioToggleField?.id ?? 'generate_audio'] = payload.audio;
    }

    if (payload.audioUrl) {
      requestBody.audio_url = payload.audioUrl;
    }

    if (typeof payload.numFrames === 'number' && Number.isFinite(payload.numFrames) && payload.numFrames > 0) {
      requestBody.num_frames = Math.round(payload.numFrames);
    } else if (!isLumaRay2EngineId(payload.engineId)) {
      const durationField = activeField(['duration']);
      if (payload.durationOption != null && (!schemaAware || durationField)) {
        requestBody.duration = normalizeFalDurationValueForModel(payload.engineId, model, payload.durationOption);
      } else if (payload.durationSec != null && (!schemaAware || durationField)) {
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
  const isLumaRay32PublicRequest = isLumaRay32EngineId(payload.engineId) && isLumaRay32PublicMode(payload.mode);
  if (isLumaRay32PublicRequest && typeof payload.loop === 'boolean') {
    requestBody.loop = payload.loop;
  }

  if (typeof payload.cfgScale === 'number') {
    requestBody.cfg_scale = payload.cfgScale;
  }

  const arrayCollectors = new Map<string, Set<string>>();
  const expectsSingleSourceVideo =
    payload.mode === 'v2v' || payload.mode === 'reframe' || payload.mode === 'extend' || payload.mode === 'retake';
  const expectsKlingO3VideoToVideoImages = payload.engineId.startsWith('kling-o3') && payload.mode === 'v2v';
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
  const inputSchema = getFalEngineById(payload.engineId)?.engine.inputSchema;
  const activeMediaFieldId = (
    candidateFieldIds: readonly string[],
    type: 'image' | 'video' | 'audio',
    fallback: string,
  ) => resolveActiveVideoInputField({
    inputSchema,
    mode: (payload.mode ?? 't2v') as Mode,
    candidateFieldIds,
    type,
  })?.id ?? fallback;
  const referenceImageFieldId = activeMediaFieldId(
    VIDEO_MEDIA_FIELD_CANDIDATES.referenceImage, 'image', 'image_urls');
  const referenceVideoFieldId = activeMediaFieldId(
    VIDEO_MEDIA_FIELD_CANDIDATES.referenceVideo, 'video', 'video_urls');
  const referenceAudioFieldId = activeMediaFieldId(
    VIDEO_MEDIA_FIELD_CANDIDATES.referenceAudio, 'audio', 'audio_urls');
  const firstFrameFieldId = activeMediaFieldId(
    VIDEO_MEDIA_FIELD_CANDIDATES.firstFrame, 'image', 'first_frame_url');
  const lastFrameFieldId = activeMediaFieldId(
    VIDEO_MEDIA_FIELD_CANDIDATES.lastFrame, 'image', 'last_frame_url');
  let primaryImageUrl = payload.imageUrl?.trim();
  let primaryAudioUrl = payload.audioUrl?.trim();

  for (const attachment of attachments) {
    const urlCandidate = attachment.url?.trim() ?? attachment.dataUrl?.trim();
    if (!urlCandidate) continue;

    const slotId = attachment.slotId?.trim();
    if (
      slotId === 'reference_images' ||
      slotId === 'images' ||
      slotId === 'image_urls' ||
      slotId === 'reference_image_urls'
    ) {
      if (expectsImageArray) {
        addToArray(referenceImageFieldId, urlCandidate);
      } else if (slotId === 'reference_images') {
        addToArray('reference_images', urlCandidate);
      } else if (slotId === 'reference_image_urls') {
        addToArray('reference_image_urls', urlCandidate);
      } else {
        addToArray(slotId === 'images' ? 'image_urls' : slotId, urlCandidate);
      }
      continue;
    }
    if (!primaryImageUrl && attachment.kind === 'image') {
      primaryImageUrl = urlCandidate;
    }
    if (!primaryAudioUrl && attachment.kind === 'audio') {
      primaryAudioUrl = urlCandidate;
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
          addToArray(referenceVideoFieldId, urlCandidate);
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
        addToArray(referenceAudioFieldId, urlCandidate);
      } else {
        addToArray(slotId === 'reference_audios' ? 'reference_audio_urls' : slotId, urlCandidate);
      }
      continue;
    }
    if (slotId === 'input_image' || slotId === 'image' || slotId === 'image_url') {
      if (expectsFirstLastFrames) {
        if (!requestBody[firstFrameFieldId]) {
          requestBody[firstFrameFieldId] = urlCandidate;
        }
        continue;
      }
      if (payload.engineId.startsWith('kling-o3') && payload.mode === 'ref2v' && slotId === 'image_url') {
        if (!requestBody.start_image_url) {
          requestBody.start_image_url = urlCandidate;
        }
        continue;
      }
      requestBody[slotId] = urlCandidate;
      continue;
    }
    if (
      slotId === 'first_frame_url' ||
      slotId === 'last_frame_url' ||
      slotId === 'start_image_url' ||
      slotId === 'end_image_url'
    ) {
      const selectedSlotId = expectsFirstLastFrames
        ? slotId === 'first_frame_url' || slotId === 'start_image_url'
          ? firstFrameFieldId
          : lastFrameFieldId
        : slotId;
      requestBody[selectedSlotId] = urlCandidate;
      continue;
    }
    if (!slotId && attachment.kind === 'image' && expectsImageArray) {
      addToArray(referenceImageFieldId, urlCandidate);
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
        addToArray(referenceAudioFieldId, urlCandidate);
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
      addToArray(referenceImageFieldId, trimmed);
      return;
    }
    if (expectsKlingO3VideoToVideoImages) {
      addToArray('image_urls', trimmed);
      return;
    }
    if (isLumaRay32PublicRequest) {
      addToArray('reference_image_urls', trimmed);
      return;
    }
    if (expectsSingleSourceVideo && (supportsHappyHorseVideoEdit(payload.engineId) || requestBody.reference_image_urls)) {
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

  if (!requestBody[firstFrameFieldId] && primaryImageUrl && expectsFirstLastFrames) {
    requestBody[firstFrameFieldId] = primaryImageUrl;
  }
  if (primaryImageUrl && !forbidsPrimaryImage && !expectsFirstLastFrames) {
    const primaryImageFieldId = activeMediaFieldId(
      payload.mode === 'i2v'
        ? ['start_image_url', 'image_url', 'first_frame_url']
        : ['image_url', 'start_image_url', 'first_frame_url'],
      'image',
      'image_url',
    );
    if (!requestBody[primaryImageFieldId]) requestBody[primaryImageFieldId] = primaryImageUrl;
  }
  if (!requestBody.audio_url && primaryAudioUrl) {
    if (!expectsImageArray) requestBody.audio_url = primaryAudioUrl;
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
