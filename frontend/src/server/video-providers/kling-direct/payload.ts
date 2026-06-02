import type { Mode } from '@/types/engines';
import { buildKlingDirectElementList, type MaxVideoProviderElement } from '@/lib/video-provider-elements';
import {
  getKlingDirectRouteCapabilities,
  type KlingDirectSubmitCapabilities,
} from './capabilities';
import {
  resolveKlingDirectCreatePath,
  resolveKlingDirectModelRoute,
  resolveKlingDirectPollPathPrefix,
  resolveKlingDirectSubmitMode,
} from './model-map';

const SUPPORTED_ASPECT_RATIOS = new Set(['16:9', '9:16', '1:1']);

type KlingDirectImageListItem = {
  image_url: string;
  type?: 'first_frame' | 'end_frame';
};

type KlingDirectVideoListItem = {
  video_url: string;
  refer_type: 'feature' | 'base';
  keep_original_sound?: 'yes' | 'no';
};

export type KlingDirectPayloadBody = {
  model_name: string;
  prompt?: string;
  negative_prompt?: string;
  duration: string;
  mode: string;
  sound: 'on' | 'off';
  aspect_ratio?: string;
  external_task_id: string;
  image?: string;
  image_tail?: string;
  image_list?: KlingDirectImageListItem[];
  video_list?: KlingDirectVideoListItem[];
  cfg_scale?: number;
  multi_shot?: boolean;
  shot_type?: 'customize' | 'intelligence';
  multi_prompt?: Array<{ index: number; prompt: string; duration: string }>;
  voice_list?: Array<{ voice_id: string }>;
  element_list?: Array<{ element_id: string | number }>;
  camera_control?: Record<string, unknown>;
  static_mask?: string;
  dynamic_masks?: Array<Record<string, unknown>>;
};

export type KlingDirectPayload = {
  providerModel: string;
  createPath: string;
  pollPathPrefix: string;
  body: KlingDirectPayloadBody;
};

function cleanString(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function normalizeDuration(durationSec: number): string {
  const duration = Math.trunc(durationSec);
  if (!Number.isFinite(duration) || duration < 3 || duration > 15) {
    throw new Error('Kling direct duration must be between 3 and 15 seconds.');
  }
  return String(duration);
}

function normalizeMultiPrompt(
  entries: Array<{ prompt: string; duration: number }> | null | undefined
): Array<{ index: number; prompt: string; duration: string }> {
  return (entries ?? [])
    .map((entry, index) => ({
      index: index + 1,
      prompt: cleanString(entry.prompt) ?? '',
      duration: String(Math.max(1, Math.trunc(entry.duration || 0))),
    }))
    .filter((entry) => entry.prompt.length > 0)
    .slice(0, 6);
}

function normalizeUrlList(values: string[] | null | undefined, maxCount: number): string[] {
  const urls: string[] = [];
  for (const value of values ?? []) {
    const url = cleanString(value);
    if (!url || urls.includes(url)) continue;
    urls.push(url);
    if (urls.length >= maxCount) break;
  }
  return urls;
}

function normalizeOmniPromptReferences(value: string): string {
  return value
    .replace(/(^|[^\w])@(Image|image)_?(\d+)\b/g, (_match, prefix: string, _kind: string, index: string) => {
      return `${prefix}<<<image_${index}>>>`;
    })
    .replace(/(^|[^\w])@(Video|video)_?(\d+)\b/g, (_match, prefix: string, _kind: string, index: string) => {
      return `${prefix}<<<video_${index}>>>`;
    })
    .replace(/(^|[^\w])@(Element|element)_?(\d+)\b/g, (_match, prefix: string, _kind: string, index: string) => {
      return `${prefix}<<<element_${index}>>>`;
    });
}

function maybeNormalizePromptReferences(value: string, endpointFamily: string): string {
  return endpointFamily === 'video-o3-omni' ? normalizeOmniPromptReferences(value) : value;
}

function normalizeShotType(value: 'customize' | 'intelligent' | 'intelligence' | null | undefined) {
  return value === 'intelligent' || value === 'intelligence' ? 'intelligence' : 'customize';
}

function normalizeVoiceList(voiceIds: string[] | null | undefined): Array<{ voice_id: string }> {
  return (voiceIds ?? [])
    .map((voiceId) => cleanString(voiceId))
    .filter((voiceId): voiceId is string => Boolean(voiceId))
    .slice(0, 2)
    .map((voice_id) => ({ voice_id }));
}

function normalizeElementList(value: unknown): Array<{ element_id: string | number }> | null {
  if (typeof value === 'string') {
    const elements = value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((element_id) => {
        const numeric = Number(element_id);
        return {
          element_id:
            Number.isInteger(numeric) && String(numeric) === element_id
              ? numeric
              : element_id,
        };
      });
    return elements.length ? elements : null;
  }
  if (!Array.isArray(value)) return null;
  const elements: Array<{ element_id: string | number }> = [];
  value.slice(0, 3).forEach((entry) => {
    if (typeof entry === 'string' && entry.trim()) {
      elements.push({ element_id: entry.trim() });
      return;
    }
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      elements.push({ element_id: Math.trunc(entry) });
      return;
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const candidate =
        (entry as { element_id?: unknown; elementId?: unknown }).element_id ??
        (entry as { element_id?: unknown; elementId?: unknown }).elementId;
      if (typeof candidate === 'string' && candidate.trim()) {
        elements.push({ element_id: candidate.trim() });
      } else if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        elements.push({ element_id: Math.trunc(candidate) });
      }
    }
  });
  return elements.length ? elements : null;
}

function parseJson(value: string, fieldId: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${fieldId} must be valid JSON.`);
  }
}

function asRecord(value: unknown, fieldId = 'value'): Record<string, unknown> | null {
  if (typeof value === 'string' && value.trim()) {
    const parsed = parseJson(value.trim(), fieldId);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${fieldId} must be valid JSON object.`);
    }
    return parsed as Record<string, unknown>;
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asRecordArray(value: unknown, fieldId: string): Array<Record<string, unknown>> {
  const candidate = typeof value === 'string' && value.trim() ? parseJson(value.trim(), fieldId) : value;
  if (typeof value === 'string' && value.trim() && !Array.isArray(candidate)) {
    throw new Error(`${fieldId} must be a valid JSON array.`);
  }
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((entry): entry is Record<string, unknown> => Boolean(asRecord(entry)));
}

function applyKlingDirectExtraInputValues(
  body: KlingDirectPayloadBody,
  extraInputValues: Record<string, unknown> | null | undefined,
  capabilities: KlingDirectSubmitCapabilities
) {
  const extra = extraInputValues ?? {};
  const cameraControl = asRecord(extra.camera_control, 'camera_control');
  if (cameraControl) {
    if (!capabilities.cameraControl) {
      throw new Error('Kling direct route does not support camera_control.');
    }
    body.camera_control = cameraControl;
  }
  const staticMask = typeof extra.static_mask === 'string' ? extra.static_mask.trim() : '';
  const dynamicMasks = asRecordArray(extra.dynamic_masks, 'dynamic_masks');
  const hasMotionBrush = Boolean(staticMask || dynamicMasks.length);
  if (hasMotionBrush && !capabilities.motionBrush) {
    throw new Error('Kling direct route does not support motion brush options.');
  }
  const exclusiveOptions = [
    body.image_tail ? 'image_tail' : null,
    cameraControl ? 'camera_control' : null,
    hasMotionBrush ? 'motion brush' : null,
  ].filter(Boolean);
  if (exclusiveOptions.length > 1) {
    throw new Error(`Kling direct image_tail, dynamic_masks/static_mask, and camera_control are mutually exclusive.`);
  }
  if (staticMask) {
    body.static_mask = staticMask;
  }
  if (dynamicMasks.length) {
    body.dynamic_masks = dynamicMasks;
  }
  const elementList = normalizeElementList(extra.element_list);
  if (elementList) {
    if (!capabilities.elementList) {
      throw new Error('Kling direct route does not support element_list.');
    }
    body.element_list = elementList;
  }
}

export function buildKlingDirectPayload(params: {
  engineId: string;
  jobId: string;
  mode: Mode | string;
  prompt: string;
  negativePrompt?: string | null;
  multiPrompt?: Array<{ prompt: string; duration: number }> | null;
  shotType?: 'customize' | 'intelligent' | 'intelligence' | null;
  voiceIds?: string[] | null;
  durationSec: number;
  aspectRatio?: string | null;
  audioEnabled?: boolean;
  imageUrl?: string | null;
  endImageUrl?: string | null;
  startImageUrl?: string | null;
  sourceVideoUrl?: string | null;
  referenceImageUrls?: string[] | null;
  keepAudio?: boolean | null;
  elements?: MaxVideoProviderElement[] | null;
  cfgScale?: number | null;
  extraInputValues?: Record<string, unknown> | null;
}): KlingDirectPayload {
  const route = resolveKlingDirectModelRoute(params.engineId);
  const createPath = resolveKlingDirectCreatePath(route, params.mode);
  const pollPathPrefix = resolveKlingDirectPollPathPrefix(route, params.mode);
  const submitMode = resolveKlingDirectSubmitMode(params.mode);
  const capabilities = getKlingDirectRouteCapabilities(route)[submitMode];
  if (!capabilities) {
    throw new Error(`Kling direct route ${route.engineId} does not support ${submitMode}.`);
  }
  const prompt = cleanString(params.prompt);
  const multiPrompt = normalizeMultiPrompt(params.multiPrompt);
  const isCustomizeMultiShot = multiPrompt.length > 0 && normalizeShotType(params.shotType) === 'customize';
  if (!prompt && !isCustomizeMultiShot) {
    throw new Error('Prompt is required for Kling direct.');
  }
  const imageUrl = cleanString(params.imageUrl);
  if (submitMode === 'i2v' && !imageUrl) {
    throw new Error('Image URL is required for Kling direct image-to-video.');
  }
  const sourceVideoUrl = cleanString(params.sourceVideoUrl);
  if (submitMode === 'v2v' && !sourceVideoUrl) {
    throw new Error('Source video URL is required for Kling direct video-to-video.');
  }

  const voiceList = capabilities.voiceControl ? normalizeVoiceList(params.voiceIds) : [];
  const hasVideoInput = submitMode === 'v2v';
  const keepAudio =
    typeof params.keepAudio === 'boolean'
      ? params.keepAudio
      : typeof params.extraInputValues?.keep_audio === 'boolean'
        ? params.extraInputValues.keep_audio
        : true;
  const body: KlingDirectPayloadBody = {
    model_name: route.providerModel,
    duration: normalizeDuration(params.durationSec),
    mode: route.mode,
    sound: !hasVideoInput && (params.audioEnabled === true || voiceList.length > 0) ? 'on' : 'off',
    external_task_id: params.jobId,
  };
  if (prompt && !isCustomizeMultiShot) {
    body.prompt = maybeNormalizePromptReferences(prompt, route.endpointFamily);
  }
  const negativePrompt = cleanString(params.negativePrompt);
  if (negativePrompt) {
    body.negative_prompt = negativePrompt;
  }
  if (multiPrompt.length > 0) {
    body.multi_shot = true;
    body.shot_type = normalizeShotType(params.shotType);
    if (body.shot_type === 'customize') {
      body.multi_prompt = multiPrompt.map((entry) => ({
        ...entry,
        prompt: maybeNormalizePromptReferences(entry.prompt, route.endpointFamily),
      }));
    }
  }
  if (params.aspectRatio && SUPPORTED_ASPECT_RATIOS.has(params.aspectRatio)) {
    body.aspect_ratio = params.aspectRatio;
  }
  if (route.endpointFamily === 'video-v3' && submitMode === 'i2v' && imageUrl) {
    body.image = imageUrl;
  }
  const endImageUrl = cleanString(params.endImageUrl);
  if (route.endpointFamily === 'video-v3' && submitMode === 'i2v' && endImageUrl) {
    body.image_tail = endImageUrl;
  }
  if (route.endpointFamily === 'video-o3-omni') {
    const referenceImageLimit = route.mode === '4k' ? 7 : 4;
    const imageList: KlingDirectImageListItem[] = normalizeUrlList(
      params.referenceImageUrls,
      referenceImageLimit
    ).map((image_url) => ({ image_url }));
    const startImageUrl =
      submitMode === 'v2v'
        ? null
        : submitMode === 'i2v'
          ? imageUrl
          : cleanString(params.startImageUrl);
    if (startImageUrl) {
      imageList.push({ image_url: startImageUrl, type: 'first_frame' });
    }
    if (submitMode !== 'v2v' && endImageUrl) {
      imageList.push({ image_url: endImageUrl, type: 'end_frame' });
    }
    if (imageList.length) {
      body.image_list = imageList;
    }
    if (submitMode === 'i2v' && !imageList.some((entry) => entry.type === 'first_frame')) {
      throw new Error('Image URL is required for Kling direct image-to-video.');
    }
    if (submitMode === 'v2v' && sourceVideoUrl) {
      body.video_list = [
        {
          video_url: sourceVideoUrl,
          refer_type: 'feature',
          keep_original_sound: keepAudio ? 'yes' : 'no',
        },
      ];
    }
  }
  if (typeof params.cfgScale === 'number' && Number.isFinite(params.cfgScale)) {
    body.cfg_scale = Math.max(0, Math.min(1, params.cfgScale));
  }
  if (voiceList.length > 0) {
    body.voice_list = voiceList;
  }
  const elementList = buildKlingDirectElementList(params.elements);
  if (elementList) {
    if (!capabilities.elementList) {
      throw new Error('Kling direct route does not support element_list.');
    }
    body.element_list = elementList;
  }
  applyKlingDirectExtraInputValues(body, params.extraInputValues, capabilities);

  return {
    providerModel: route.providerModel,
    createPath,
    pollPathPrefix,
    body,
  };
}
