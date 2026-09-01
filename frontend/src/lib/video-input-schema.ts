import type { EngineInputField, EngineInputSchema, Mode } from '@/types/engines';

export const VIDEO_MEDIA_FIELD_CANDIDATES = Object.freeze({
  firstFrame: ['first_frame_url', 'start_image_url', 'image_url'],
  lastFrame: ['last_frame_url', 'end_image_url'],
  referenceImage: ['image_urls', 'reference_images', 'reference_image_urls'],
  referenceVideo: ['video_urls', 'reference_video_urls'],
  referenceAudio: ['audio_urls', 'reference_audio_urls'],
  sourceAudio: ['audio_url'],
  sourceVideo: ['video_url', 'extension_source_videos', 'video_urls'],
} as const);

export function listActiveVideoInputFields(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode,
): EngineInputField[] {
  return [
    ...(inputSchema?.required ?? []),
    ...(inputSchema?.optional ?? []),
  ].filter((field) => !field.modes?.length || field.modes.includes(mode));
}

export function resolveActiveVideoInputField(params: {
  inputSchema: EngineInputSchema | null | undefined;
  mode: Mode;
  candidateFieldIds: readonly string[];
  type?: EngineInputField['type'];
}): EngineInputField | null {
  const fields = listActiveVideoInputFields(params.inputSchema, params.mode);
  for (const fieldId of params.candidateFieldIds) {
    const field = fields.find((candidate) =>
      candidate.id === fieldId && (!params.type || candidate.type === params.type));
    if (field) return field;
  }
  return null;
}

export function projectVideoProviderFieldValue(
  field: EngineInputField | null,
  value: unknown,
  inputSchema?: EngineInputSchema | null,
): unknown {
  if (!field || field.type !== 'enum' || !field.values?.length) return value;
  if (field.values.some((allowed) => String(allowed) === String(value))) return value;
  if (value === 'auto' && field.values.includes('adaptive')) return 'adaptive';
  const resolutionAliases = inputSchema?.constraints?.canonicalResolutionAliases;
  if (
    field.id === 'resolution'
    && resolutionAliases
    && typeof resolutionAliases === 'object'
    && !Array.isArray(resolutionAliases)
  ) {
    const projected = (resolutionAliases as Record<string, unknown>)[String(value)];
    if (field.values.some((allowed) => String(allowed) === String(projected))) return projected;
  }
  return value;
}

export type VideoSchemaControlConstraintViolation = {
  field: 'duration';
  maxDurationSec: number;
};

export function getVideoSchemaControlConstraintViolation(params: {
  inputSchema: EngineInputSchema | null | undefined;
  duration: unknown;
  resolution?: unknown;
  fps?: unknown;
}): VideoSchemaControlConstraintViolation | null {
  const duration = typeof params.duration === 'number'
    ? params.duration
    : typeof params.duration === 'string' && params.duration.trim().length
      ? Number(params.duration)
      : Number.NaN;
  if (!Number.isFinite(duration)) return null;
  const constraints = params.inputSchema?.constraints;
  const fields = [
    ...(params.inputSchema?.required ?? []),
    ...(params.inputSchema?.optional ?? []),
  ];
  const fpsMax = constraints?.fastHighFpsMaxDurationSec;
  const fps = typeof params.fps === 'number'
    ? params.fps
    : typeof params.fps === 'string' && params.fps.trim().length
      ? Number(params.fps)
      : Number.NaN;
  const highFpsValues = fields
    .find((field) => field.id === 'fps' && field.type === 'enum')
    ?.values?.map(Number)
    .filter((value) => Number.isFinite(value) && value >= 48) ?? [];
  if (
    typeof fpsMax === 'number'
    && Number.isFinite(fps)
    && highFpsValues.includes(fps)
    && duration > fpsMax
  ) {
    return { field: 'duration', maxDurationSec: fpsMax };
  }
  const resolutionMax = constraints?.fastHighResolutionMaxDurationSec;
  const resolutionField = fields.find((field) => field.id === 'resolution' && field.type === 'enum') ?? null;
  const providerResolution = projectVideoProviderFieldValue(
    resolutionField,
    params.resolution,
    params.inputSchema,
  );
  const highResolutionValues = resolutionField?.values?.filter((value) => {
    const verticalPixels = Number.parseInt(value, 10);
    return Number.isFinite(verticalPixels) && verticalPixels >= 1440;
  }) ?? [];
  if (
    typeof resolutionMax === 'number'
    && highResolutionValues.includes(String(providerResolution))
    && duration > resolutionMax
  ) {
    return { field: 'duration', maxDurationSec: resolutionMax };
  }
  return null;
}
