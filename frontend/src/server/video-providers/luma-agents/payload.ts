import type { Mode } from '@/types/engines';
import { LumaAgentsError } from './errors';
import { resolveLumaAgentsModelRoute, type LumaAgentsGenerationType } from './model-map';
import {
  LUMA_AGENTS_DEFAULT_VIDEO_DURATION,
  LUMA_AGENTS_DEFAULT_VIDEO_RESOLUTION,
  LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS,
  LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS,
  LUMA_AGENTS_RAY_32_EDIT_STRENGTHS,
  LUMA_AGENTS_RAY_32_POSE_STRENGTHS,
  type LumaAgentsRay32DirectDuration,
  type LumaAgentsRay32DirectResolution,
} from './constants';

type LumaAgentsFrame = { url: string };
type LumaAgentsSource = { generation_id: string } | { url: string; media_type: string } | { data: string; media_type: string };
type LumaAgentsEditStrength = (typeof LUMA_AGENTS_RAY_32_EDIT_STRENGTHS)[number];
type LumaAgentsPoseStrength = Exclude<(typeof LUMA_AGENTS_RAY_32_POSE_STRENGTHS)[number], 'off'>;

type LumaAgentsVideoEditControls = {
  pose?: { enabled: boolean; strength?: LumaAgentsPoseStrength };
  depth?: { enabled: boolean; blur?: number };
  normals?: { enabled: boolean; augmentation?: number };
  trajectory?: { enabled: boolean; sparsity?: number };
  face?: { enabled: boolean };
};

type LumaAgentsVideoEdit = {
  auto_controls?: boolean;
  strength?: Exclude<LumaAgentsEditStrength, 'auto'>;
  controls?: LumaAgentsVideoEditControls;
  keyframes?: LumaAgentsFrame[];
  keyframe_indexes?: number[];
};

type LumaAgentsSourcePosition = {
  x_norm: number;
  y_norm: number;
  w_norm: number;
  h_norm: number;
};

export type LumaAgentsVideoOptions = {
  resolution: LumaAgentsRay32DirectResolution;
  duration?: LumaAgentsRay32DirectDuration;
  loop?: boolean;
  start_frame?: LumaAgentsFrame;
  end_frame?: LumaAgentsFrame;
  edit?: LumaAgentsVideoEdit;
  source_position?: LumaAgentsSourcePosition;
  hdr?: boolean;
  exr_export?: boolean;
};

export type LumaAgentsVideoPayload = {
  model: 'ray-3.2';
  type: LumaAgentsGenerationType;
  prompt?: string;
  aspect_ratio?: string;
  source?: LumaAgentsSource;
  video: LumaAgentsVideoOptions;
};

const DIRECT_ASPECT_RATIOS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS);
const DIRECT_RESOLUTIONS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS);
const EDIT_STRENGTHS = new Set<string>(LUMA_AGENTS_RAY_32_EDIT_STRENGTHS);
const POSE_STRENGTHS = new Set<string>(LUMA_AGENTS_RAY_32_POSE_STRENGTHS);

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function invalidRequest(message: string, code = 'LUMA_AGENTS_INVALID_REQUEST', raw?: unknown): never {
  throw new LumaAgentsError(message, {
    code,
    errorClass: 'invalid_request',
    body: raw ?? { message },
  });
}

function normalizeDuration(params: {
  durationOption?: string | number | null;
  durationSec?: number | null;
}): LumaAgentsRay32DirectDuration {
  const raw = params.durationOption ?? params.durationSec ?? LUMA_AGENTS_DEFAULT_VIDEO_DURATION;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === '5' || normalized === '5s') return '5s';
    if (normalized === '10' || normalized === '10s') return '10s';
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const duration = Math.trunc(raw);
    if (duration === 5) return '5s';
    if (duration === 10) return '10s';
  }
  invalidRequest('Luma Ray 3.2 direct supports 5s or 10s duration.', 'LUMA_AGENTS_UNSUPPORTED_DURATION', {
    durationOption: params.durationOption,
    durationSec: params.durationSec,
  });
}

function normalizeResolution(value: string | null | undefined): LumaAgentsRay32DirectResolution {
  const resolution = cleanString(value) ?? LUMA_AGENTS_DEFAULT_VIDEO_RESOLUTION;
  if (DIRECT_RESOLUTIONS.has(resolution)) return resolution as LumaAgentsRay32DirectResolution;
  invalidRequest('Luma Ray 3.2 direct supports 540p, 720p, or 1080p resolution.', 'LUMA_AGENTS_UNSUPPORTED_RESOLUTION', {
    resolution: value,
  });
}

function validateAspectRatio(value: string | null | undefined): string | undefined {
  const aspectRatio = cleanString(value);
  if (!aspectRatio) return undefined;
  if (DIRECT_ASPECT_RATIOS.has(aspectRatio)) return aspectRatio;
  invalidRequest(
    'Luma Ray 3.2 direct supports 9:16, 3:4, 1:1, 4:3, 16:9, or 21:9 aspect ratios.',
    'LUMA_AGENTS_UNSUPPORTED_ASPECT_RATIO',
    { aspectRatio: value }
  );
}

function assertNoReferenceImages(referenceImageUrls: string[] | null | undefined) {
  if ((referenceImageUrls?.length ?? 0) === 0) return;
  invalidRequest('Luma Ray 3.2 direct does not support reference_image_urls.', 'LUMA_AGENTS_REFERENCE_IMAGES_UNSUPPORTED', {
    referenceImageCount: referenceImageUrls?.length ?? 0,
  });
}

function applyCompatibilityRules(params: {
  type: LumaAgentsGenerationType;
  duration: LumaAgentsRay32DirectDuration;
  resolution: LumaAgentsRay32DirectResolution;
  aspectRatio?: string;
  loop: boolean;
  hasStartFrame: boolean;
  hasEndFrame: boolean;
  hasEdit: boolean;
  hasSourcePosition: boolean;
  hdr: boolean;
  exrExport: boolean;
}) {
  if (params.type === 'video' && params.duration === '10s' && (params.hasStartFrame || params.hasEndFrame)) {
    invalidRequest('Luma Ray 3.2 direct rejects 10s duration with start_frame or end_frame.', 'LUMA_AGENTS_10S_FRAME_UNSUPPORTED');
  }
  if (params.type === 'video' && params.duration === '10s' && params.loop) {
    invalidRequest('Luma Ray 3.2 direct rejects loop with 10s duration.', 'LUMA_AGENTS_LOOP_10S_UNSUPPORTED');
  }
  if (params.type === 'video' && params.loop && params.hasEndFrame) {
    invalidRequest('Luma Ray 3.2 direct rejects loop with end_frame.', 'LUMA_AGENTS_LOOP_END_FRAME_UNSUPPORTED');
  }
  if (params.type === 'video_edit' && params.loop) {
    invalidRequest('Luma Ray 3.2 video_edit rejects loop.', 'LUMA_AGENTS_EDIT_LOOP_UNSUPPORTED');
  }
  if (params.type === 'video_edit' && params.hasEndFrame) {
    invalidRequest('Luma Ray 3.2 video_edit rejects end_frame.', 'LUMA_AGENTS_EDIT_END_FRAME_UNSUPPORTED');
  }
  if (params.type === 'video_reframe' && params.loop) {
    invalidRequest('Luma Ray 3.2 video_reframe rejects loop.', 'LUMA_AGENTS_REFRAME_LOOP_UNSUPPORTED');
  }
  if (params.type === 'video_reframe' && (params.hdr || params.exrExport)) {
    invalidRequest('Luma Ray 3.2 video_reframe rejects HDR and EXR export.', 'LUMA_AGENTS_REFRAME_HDR_UNSUPPORTED');
  }
  if (params.type === 'video_reframe' && (params.hasStartFrame || params.hasEndFrame || params.hasEdit)) {
    invalidRequest('Luma Ray 3.2 video_reframe rejects edit and frame controls.', 'LUMA_AGENTS_REFRAME_EDIT_UNSUPPORTED');
  }
  if (
    params.type === 'video_reframe' &&
    params.resolution === '1080p' &&
    (params.aspectRatio === '9:16' || params.aspectRatio === '3:4')
  ) {
    invalidRequest('Luma Ray 3.2 video_reframe rejects 1080p vertical targets.', 'LUMA_AGENTS_REFRAME_VERTICAL_1080P_UNSUPPORTED');
  }
  if (params.type !== 'video_reframe' && params.hasSourcePosition) {
    invalidRequest('Luma Ray 3.2 source_position is only valid for video_reframe.', 'LUMA_AGENTS_SOURCE_POSITION_UNSUPPORTED');
  }
  if (params.hdr && params.resolution === '540p') {
    invalidRequest('Luma Ray 3.2 HDR requires 720p or 1080p resolution.', 'LUMA_AGENTS_HDR_RESOLUTION_UNSUPPORTED');
  }
  if (params.type === 'video' && params.hdr && params.duration === '10s') {
    invalidRequest('Luma Ray 3.2 direct rejects HDR with 10s duration.', 'LUMA_AGENTS_HDR_10S_UNSUPPORTED');
  }
  if (params.hdr && params.loop) {
    invalidRequest('Luma Ray 3.2 direct rejects HDR with loop.', 'LUMA_AGENTS_HDR_LOOP_UNSUPPORTED');
  }
  if (params.exrExport && !params.hdr) {
    invalidRequest('Luma Ray 3.2 EXR export requires hdr: true.', 'LUMA_AGENTS_EXR_REQUIRES_HDR');
  }
}

function normalizeVideoMimeType(value: string | null | undefined, url: string): string {
  const mediaType = cleanString(value)?.toLowerCase();
  if (mediaType?.startsWith('video/')) return mediaType;
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.mov')) return 'video/quicktime';
  if (path.endsWith('.webm')) return 'video/webm';
  if (path.endsWith('.m4v')) return 'video/x-m4v';
  return 'video/mp4';
}

function buildSource(params: {
  extra: Record<string, unknown>;
  sourceVideoUrl: string | null;
  sourceVideoMimeType?: string | null;
}): LumaAgentsSource | undefined {
  const generationId = cleanString(params.extra.source_generation_id);
  if (generationId) return { generation_id: generationId };
  if (!params.sourceVideoUrl) return undefined;
  return {
    url: params.sourceVideoUrl,
    media_type: normalizeVideoMimeType(cleanString(params.extra.source_media_type) ?? params.sourceVideoMimeType, params.sourceVideoUrl),
  };
}

function requireRange(value: number, min: number, max: number, label: string): number {
  if (value < min || value > max) {
    invalidRequest(`${label} must be between ${min} and ${max}.`, 'LUMA_AGENTS_NUMBER_OUT_OF_RANGE', {
      label,
      value,
      min,
      max,
    });
  }
  return value;
}

function parseKeyframeIndexes(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const parsed = numberValue(entry);
      if (parsed === null || parsed < 0) {
        invalidRequest('Luma Ray 3.2 keyframe indexes must be non-negative numbers.', 'LUMA_AGENTS_KEYFRAME_INDEX_INVALID');
      }
      return Math.trunc(parsed);
    });
  }
  const text = cleanString(value);
  if (!text) return [];
  return text.split(',').map((entry) => {
    const parsed = numberValue(entry.trim());
    if (parsed === null || parsed < 0) {
      invalidRequest('Luma Ray 3.2 keyframe indexes must be non-negative numbers.', 'LUMA_AGENTS_KEYFRAME_INDEX_INVALID');
    }
    return Math.trunc(parsed);
  });
}

function buildEditControls(extra: Record<string, unknown>): LumaAgentsVideoEditControls | undefined {
  const controls: LumaAgentsVideoEditControls = {};
  const pose = cleanString(extra.edit_pose_strength);
  if (pose && pose !== 'off') {
    if (!POSE_STRENGTHS.has(pose) || pose === 'off') {
      invalidRequest('Luma Ray 3.2 pose strength must be precise, coarse, or off.', 'LUMA_AGENTS_POSE_STRENGTH_UNSUPPORTED');
    }
    controls.pose = { enabled: true, strength: pose as LumaAgentsPoseStrength };
  }
  const depthBlur = numberValue(extra.edit_depth_blur);
  if (depthBlur !== null) {
    controls.depth = { enabled: true, blur: requireRange(depthBlur, 0, 1, 'Depth blur') };
  }
  const normalsAugmentation = numberValue(extra.edit_normals_augmentation);
  if (normalsAugmentation !== null) {
    controls.normals = { enabled: true, augmentation: requireRange(normalsAugmentation, 0, 1, 'Normals augmentation') };
  }
  const trajectorySparsity = numberValue(extra.edit_trajectory_sparsity);
  if (trajectorySparsity !== null) {
    controls.trajectory = { enabled: true, sparsity: requireRange(trajectorySparsity, 0, 1, 'Trajectory sparsity') };
  }
  if (booleanValue(extra.edit_face)) {
    controls.face = { enabled: true };
  }
  return Object.keys(controls).length ? controls : undefined;
}

function buildVideoEdit(params: {
  extra: Record<string, unknown>;
  startFrameUrl: string | null;
  keyframeUrls: string[];
}): LumaAgentsVideoEdit {
  const keyframeIndexes = parseKeyframeIndexes(params.extra.edit_keyframe_indexes);
  if (params.startFrameUrl && params.keyframeUrls.length > 0) {
    invalidRequest('Luma Ray 3.2 video_edit rejects start_frame combined with keyframes.', 'LUMA_AGENTS_EDIT_FRAME_CONFLICT');
  }
  if (params.keyframeUrls.length !== keyframeIndexes.length) {
    invalidRequest('Luma Ray 3.2 keyframes require one index per keyframe.', 'LUMA_AGENTS_KEYFRAME_COUNT_MISMATCH', {
      keyframeCount: params.keyframeUrls.length,
      keyframeIndexCount: keyframeIndexes.length,
    });
  }
  if (new Set(keyframeIndexes).size !== keyframeIndexes.length) {
    invalidRequest('Luma Ray 3.2 keyframe indexes must be unique.', 'LUMA_AGENTS_KEYFRAME_INDEX_DUPLICATE');
  }

  const controls = buildEditControls(params.extra);
  const strength = cleanString(params.extra.edit_strength) ?? 'auto';
  if (!EDIT_STRENGTHS.has(strength)) {
    invalidRequest('Luma Ray 3.2 edit_strength is not supported.', 'LUMA_AGENTS_EDIT_STRENGTH_UNSUPPORTED', {
      strength,
    });
  }

  const edit: LumaAgentsVideoEdit = {};
  if (controls) {
    edit.controls = controls;
  } else if (strength === 'auto') {
    edit.auto_controls = true;
  } else {
    edit.strength = strength as Exclude<LumaAgentsEditStrength, 'auto'>;
  }

  if (params.keyframeUrls.length > 0) {
    edit.keyframes = params.keyframeUrls.map((url) => ({ url }));
    edit.keyframe_indexes = keyframeIndexes;
  }
  return edit;
}

function buildSourcePosition(extra: Record<string, unknown>): LumaAgentsSourcePosition | undefined {
  const x = numberValue(extra.source_position_x_norm);
  const y = numberValue(extra.source_position_y_norm);
  const w = numberValue(extra.source_position_w_norm);
  const h = numberValue(extra.source_position_h_norm);
  const values = [x, y, w, h];
  if (values.every((value) => value === null)) return undefined;
  if (values.some((value) => value === null)) {
    invalidRequest('Luma Ray 3.2 source_position requires x, y, width, and height.', 'LUMA_AGENTS_SOURCE_POSITION_INCOMPLETE');
  }
  return {
    x_norm: requireRange(x as number, -2, 2, 'source_position.x_norm'),
    y_norm: requireRange(y as number, -2, 2, 'source_position.y_norm'),
    w_norm: requireRange(w as number, 0.0001, 2, 'source_position.w_norm'),
    h_norm: requireRange(h as number, 0.0001, 2, 'source_position.h_norm'),
  };
}

export function buildLumaAgentsVideoPayload(params: {
  engineId: string;
  mode: Mode | string;
  prompt: string;
  durationSec: number;
  durationOption?: string | number | null;
  aspectRatio?: string | null;
  resolution?: string | null;
  loop?: boolean | null;
  imageUrl?: string | null;
  endImageUrl?: string | null;
  videoUrl?: string | null;
  sourceVideoMimeType?: string | null;
  keyframeUrls?: string[] | null;
  referenceImageUrls?: string[] | null;
  extraInputValues?: Record<string, unknown> | null;
  advancedDirectOnlyEnabled?: boolean;
}): LumaAgentsVideoPayload {
  if (params.mode === 'extend') {
    invalidRequest(
      'Luma Ray 3.2 direct does not support extend mode.',
      'LUMA_AGENTS_EXTEND_UNSUPPORTED'
    );
  }

  const route = resolveLumaAgentsModelRoute({ engineId: params.engineId, mode: params.mode });

  assertNoReferenceImages(params.referenceImageUrls);

  const prompt = cleanString(params.prompt);
  if (!prompt) {
    invalidRequest('Prompt is required for Luma Agents video generation.', 'LUMA_AGENTS_PROMPT_REQUIRED');
  }

  const duration =
    route.type === 'video_reframe'
      ? LUMA_AGENTS_DEFAULT_VIDEO_DURATION
      : normalizeDuration({
          durationOption: params.durationOption,
          durationSec: params.durationSec,
        });
  const resolution = normalizeResolution(params.resolution);
  const aspectRatio = validateAspectRatio(params.aspectRatio);
  const extra = params.extraInputValues ?? {};
  const hdrRequested = booleanValue(extra.hdr);
  const exrExportRequested = booleanValue(extra.exr_export ?? extra.exrExport);
  const hdr = hdrRequested;
  const exrExport = exrExportRequested;
  const loop = params.loop === true;
  const startFrameUrl = cleanString(params.imageUrl);
  const endFrameUrl = cleanString(params.endImageUrl);
  const sourceVideoUrl = cleanString(params.videoUrl);
  const keyframeUrls = (params.keyframeUrls ?? []).map(cleanString).filter((url): url is string => Boolean(url));
  const source = buildSource({ extra, sourceVideoUrl, sourceVideoMimeType: params.sourceVideoMimeType });
  const edit = route.type === 'video_edit' ? buildVideoEdit({ extra, startFrameUrl, keyframeUrls }) : undefined;
  const sourcePosition = route.type === 'video_reframe' ? buildSourcePosition(extra) : undefined;

  if (params.mode === 'i2v' && !startFrameUrl) {
    invalidRequest('Luma Ray 3.2 image-to-video requires start_frame.', 'LUMA_AGENTS_START_FRAME_REQUIRED');
  }
  if ((params.mode === 'v2v' || params.mode === 'reframe' || params.mode === 'extend') && !source) {
    invalidRequest('Luma Ray 3.2 advanced video modes require a source video.', 'LUMA_AGENTS_SOURCE_VIDEO_REQUIRED');
  }
  if (route.type === 'video_reframe' && !aspectRatio) {
    invalidRequest('Luma Ray 3.2 video_reframe requires aspect_ratio.', 'LUMA_AGENTS_REFRAME_ASPECT_RATIO_REQUIRED');
  }

  applyCompatibilityRules({
    type: route.type,
    duration,
    resolution,
    aspectRatio,
    loop,
    hasStartFrame: Boolean(startFrameUrl),
    hasEndFrame: Boolean(endFrameUrl),
    hasEdit: Boolean(edit),
    hasSourcePosition: Boolean(sourcePosition),
    hdr,
    exrExport,
  });

  const video: LumaAgentsVideoOptions = {
    resolution,
  };
  if (route.type !== 'video_reframe') video.duration = duration;
  if (loop && route.type === 'video') video.loop = true;
  if (startFrameUrl && route.type !== 'video_reframe') video.start_frame = { url: startFrameUrl };
  if (endFrameUrl && route.type === 'video') video.end_frame = { url: endFrameUrl };
  if (edit && route.type === 'video_edit') video.edit = edit;
  if (sourcePosition && route.type === 'video_reframe') video.source_position = sourcePosition;
  if (hdr) video.hdr = true;
  if (exrExport) video.exr_export = true;

  return {
    model: route.providerModel,
    type: route.type,
    prompt,
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(source ? { source } : {}),
    video,
  };
}
