import type { GeneratePayload } from '@/lib/fal-types';
import type { Mode } from '@/types/engines';
import { resolveLumaDirectGenerationType, resolveLumaDirectModelRoute } from './model-map';

type LumaImageRef = {
  url?: string;
  generation_id?: string;
};

type LumaSourceRef = {
  url?: string;
  generation_id?: string;
  media_type?: string;
};

type LumaDirectRequestBody = {
  model: 'ray-3.2';
  type: 'video' | 'video_edit' | 'video_reframe';
  prompt: string;
  aspect_ratio?: string;
  source?: LumaSourceRef;
  video?: Record<string, unknown>;
};

export type LumaDirectPayload = {
  createPath: '/v1/generations';
  providerModel: 'ray-3.2';
  body: LumaDirectRequestBody;
};

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null;
}

function durationToLumaValue(durationSec: number, explicitValue?: unknown): '5s' | '10s' {
  const explicit = cleanString(explicitValue);
  if (explicit === '10s' || explicit === '10') return '10s';
  if (explicit === '5s' || explicit === '5') return '5s';
  return durationSec >= 10 ? '10s' : '5s';
}

function imageRefFromUrl(value: unknown): LumaImageRef | null {
  const url = cleanString(value);
  return url ? { url } : null;
}

function mediaTypeForVideoUrl(url: string): string {
  const lower = url.split('?')[0]?.toLowerCase() ?? '';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.m4v')) return 'video/x-m4v';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'video/mp4';
}

function sourceRefFromVideoUrl(value: unknown): LumaSourceRef | null {
  const url = cleanString(value);
  return url ? { url, media_type: mediaTypeForVideoUrl(url) } : null;
}

function assignBoolean(video: Record<string, unknown>, key: string, value: unknown) {
  if (typeof value === 'boolean') {
    video[key] = value;
  }
}

function assignString(video: Record<string, unknown>, key: string, value: unknown) {
  const text = cleanString(value);
  if (text) {
    video[key] = text;
  }
}

function arrayImageRefs(values: unknown): LumaImageRef[] | null {
  if (!Array.isArray(values)) return null;
  const refs = values
    .map((value) => imageRefFromUrl(value))
    .filter((ref): ref is LumaImageRef => ref != null);
  return refs.length ? refs : null;
}

export function buildLumaDirectPayload(params: {
  engineId: string;
  mode: Mode | string;
  prompt: string;
  durationSec: number;
  aspectRatio: string | null;
  resolution: string | null;
  imageUrl?: string | null;
  falPayload: GeneratePayload;
}): LumaDirectPayload {
  const route = resolveLumaDirectModelRoute(params.engineId);
  const type = resolveLumaDirectGenerationType(params.mode);
  const extra = params.falPayload.extraInputValues ?? {};
  const video: Record<string, unknown> = {};
  const resolution = cleanString(params.resolution) ?? cleanString(params.falPayload.resolution);
  if (resolution) {
    video.resolution = resolution;
  }

  if (type === 'video') {
    video.duration = durationToLumaValue(
      params.durationSec,
      params.falPayload.durationOption ?? extra.duration ?? extra.duration_seconds
    );
    assignBoolean(video, 'loop', params.falPayload.loop ?? extra.loop);
    assignBoolean(video, 'hdr', extra.hdr);
    assignBoolean(video, 'exr_export', extra.exr_export);

    const startFrame =
      imageRefFromUrl(params.falPayload.imageUrl) ??
      imageRefFromUrl(params.imageUrl) ??
      imageRefFromUrl(extra.image_url) ??
      imageRefFromUrl(extra.start_image_url);
    if (startFrame) {
      video.start_frame = startFrame;
    }
    const endFrame = imageRefFromUrl(params.falPayload.endImageUrl) ?? imageRefFromUrl(extra.end_image_url);
    if (endFrame) {
      video.end_frame = endFrame;
    }
    const keyframes = arrayImageRefs(extra.keyframes);
    if (keyframes) {
      video.keyframes = keyframes;
      if (Array.isArray(extra.keyframe_indexes)) {
        video.keyframe_indexes = extra.keyframe_indexes;
      }
    }
  }

  if (type === 'video_edit') {
    assignBoolean(video, 'hdr', extra.hdr);
    assignBoolean(video, 'exr_export', extra.exr_export);
    const guideFrame = imageRefFromUrl(extra.start_image_url) ?? imageRefFromUrl(params.imageUrl);
    if (guideFrame) {
      video.start_frame = guideFrame;
    }
    const edit: Record<string, unknown> = {};
    assignString(edit, 'strength', extra.edit_strength ?? extra.mode);
    assignBoolean(edit, 'auto_controls', extra.auto_controls);
    if (extra.controls && typeof extra.controls === 'object') {
      edit.controls = extra.controls;
    }
    const keyframes = arrayImageRefs(extra.keyframes);
    if (keyframes) {
      edit.keyframes = keyframes;
      if (Array.isArray(extra.keyframe_indexes)) {
        edit.keyframe_indexes = extra.keyframe_indexes;
      }
    }
    if (Object.keys(edit).length > 0) {
      video.edit = edit;
    }
  }

  if (type === 'video_reframe' && extra.source_position && typeof extra.source_position === 'object') {
    video.source_position = extra.source_position;
  }

  const body: LumaDirectRequestBody = {
    model: route.providerModel,
    type,
    prompt: params.prompt,
  };
  const aspectRatio = cleanString(params.aspectRatio) ?? cleanString(params.falPayload.aspectRatio);
  if ((type === 'video' || type === 'video_reframe') && aspectRatio) {
    body.aspect_ratio = aspectRatio;
  }
  if (type === 'video_edit' || type === 'video_reframe') {
    const source = sourceRefFromVideoUrl(params.falPayload.videoUrl ?? extra.video_url);
    if (source) {
      body.source = source;
    }
  }
  if (Object.keys(video).length > 0) {
    body.video = video;
  }

  return {
    createPath: '/v1/generations',
    providerModel: route.providerModel,
    body,
  };
}
