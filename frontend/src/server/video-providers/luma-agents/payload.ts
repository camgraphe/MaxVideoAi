import type { Mode } from '@/types/engines';
import { LumaAgentsError } from './errors';
import { resolveLumaAgentsModelRoute, type LumaAgentsGenerationType } from './model-map';
import {
  LUMA_AGENTS_DEFAULT_VIDEO_DURATION,
  LUMA_AGENTS_DEFAULT_VIDEO_RESOLUTION,
  LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS,
  LUMA_AGENTS_RAY_32_DIRECT_DURATIONS,
  LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS,
  type LumaAgentsRay32DirectDuration,
  type LumaAgentsRay32DirectResolution,
} from './constants';

type LumaAgentsFrame = { url: string };

export type LumaAgentsVideoOptions = {
  resolution: LumaAgentsRay32DirectResolution;
  duration: LumaAgentsRay32DirectDuration;
  loop?: boolean;
  start_frame?: LumaAgentsFrame;
  end_frame?: LumaAgentsFrame;
  source?: LumaAgentsFrame;
  hdr?: boolean;
  exr_export?: boolean;
};

export type LumaAgentsVideoPayload = {
  model: 'ray-3.2';
  type: LumaAgentsGenerationType;
  prompt?: string;
  aspect_ratio?: string;
  video: LumaAgentsVideoOptions;
};

const DIRECT_ASPECT_RATIOS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_ASPECT_RATIOS);
const DIRECT_DURATIONS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_DURATIONS);
const DIRECT_RESOLUTIONS = new Set<string>(LUMA_AGENTS_RAY_32_DIRECT_RESOLUTIONS);

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
  return false;
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
  mode: Mode | string;
  duration: LumaAgentsRay32DirectDuration;
  resolution: LumaAgentsRay32DirectResolution;
  loop: boolean;
  hasStartFrame: boolean;
  hasEndFrame: boolean;
  hdr: boolean;
  exrExport: boolean;
}) {
  if (params.duration === '10s' && (params.hasStartFrame || params.hasEndFrame)) {
    invalidRequest('Luma Ray 3.2 direct rejects 10s duration with start_frame or end_frame.', 'LUMA_AGENTS_10S_FRAME_UNSUPPORTED');
  }
  if (params.duration === '10s' && params.loop) {
    invalidRequest('Luma Ray 3.2 direct rejects loop with 10s duration.', 'LUMA_AGENTS_LOOP_10S_UNSUPPORTED');
  }
  if (params.loop && params.hasEndFrame) {
    invalidRequest('Luma Ray 3.2 direct rejects loop with end_frame.', 'LUMA_AGENTS_LOOP_END_FRAME_UNSUPPORTED');
  }
  if (params.hdr && params.resolution === '540p') {
    invalidRequest('Luma Ray 3.2 HDR requires 720p or 1080p resolution.', 'LUMA_AGENTS_HDR_RESOLUTION_UNSUPPORTED');
  }
  if (params.hdr && params.duration === '10s') {
    invalidRequest('Luma Ray 3.2 direct rejects HDR with 10s duration.', 'LUMA_AGENTS_HDR_10S_UNSUPPORTED');
  }
  if (params.hdr && params.loop) {
    invalidRequest('Luma Ray 3.2 direct rejects HDR with loop.', 'LUMA_AGENTS_HDR_LOOP_UNSUPPORTED');
  }
  if (params.exrExport && !params.hdr) {
    invalidRequest('Luma Ray 3.2 EXR export requires hdr: true.', 'LUMA_AGENTS_EXR_REQUIRES_HDR');
  }
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
  if ((params.mode === 'v2v' || params.mode === 'reframe') && !params.advancedDirectOnlyEnabled) {
    invalidRequest('Advanced Luma Agents direct video modes are disabled.', 'LUMA_AGENTS_ADVANCED_DISABLED');
  }

  assertNoReferenceImages(params.referenceImageUrls);

  const prompt = cleanString(params.prompt);
  if (!prompt) {
    invalidRequest('Prompt is required for Luma Agents video generation.', 'LUMA_AGENTS_PROMPT_REQUIRED');
  }

  const duration = normalizeDuration({
    durationOption: params.durationOption,
    durationSec: params.durationSec,
  });
  const resolution = normalizeResolution(params.resolution);
  const aspectRatio = validateAspectRatio(params.aspectRatio);
  const extra = params.extraInputValues ?? {};
  const hdr = params.advancedDirectOnlyEnabled === true && booleanValue(extra.hdr);
  const exrExport =
    params.advancedDirectOnlyEnabled === true && booleanValue(extra.exr_export ?? extra.exrExport);
  const loop = params.loop === true;
  const startFrameUrl = cleanString(params.imageUrl);
  const endFrameUrl = cleanString(params.endImageUrl);
  const sourceVideoUrl = cleanString(params.videoUrl);

  if (params.mode === 'i2v' && !startFrameUrl) {
    invalidRequest('Luma Ray 3.2 image-to-video requires start_frame.', 'LUMA_AGENTS_START_FRAME_REQUIRED');
  }
  if ((params.mode === 'v2v' || params.mode === 'reframe' || params.mode === 'extend') && !sourceVideoUrl) {
    invalidRequest('Luma Ray 3.2 advanced video modes require a source video.', 'LUMA_AGENTS_SOURCE_VIDEO_REQUIRED');
  }

  applyCompatibilityRules({
    mode: params.mode,
    duration,
    resolution,
    loop,
    hasStartFrame: Boolean(startFrameUrl),
    hasEndFrame: Boolean(endFrameUrl),
    hdr,
    exrExport,
  });

  const video: LumaAgentsVideoOptions = {
    resolution,
    duration,
  };
  if (loop) video.loop = true;
  if (startFrameUrl) video.start_frame = { url: startFrameUrl };
  if (endFrameUrl) video.end_frame = { url: endFrameUrl };
  if (sourceVideoUrl && route.type !== 'video') video.source = { url: sourceVideoUrl };
  if (hdr) video.hdr = true;
  if (exrExport) video.exr_export = true;

  return {
    model: route.providerModel,
    type: route.type,
    prompt,
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    video,
  };
}
