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
): unknown {
  if (!field || field.type !== 'enum' || !field.values?.length) return value;
  if (field.values.some((allowed) => String(allowed) === String(value))) return value;
  if (value === 'auto' && field.values.includes('adaptive')) return 'adaptive';
  if (value === '4k' && field.values.includes('2160p')) return '2160p';
  return value;
}
