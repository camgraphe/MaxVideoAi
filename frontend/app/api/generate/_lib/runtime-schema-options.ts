import type { EngineInputSchema, EngineModeUiCaps, Mode } from '@/types/engines';

function getActiveEnumField(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode,
  fieldId: string,
) {
  return [...(inputSchema?.required ?? []), ...(inputSchema?.optional ?? [])].find((field) => (
    field.id === fieldId
    && field.type === 'enum'
    && (!field.modes?.length || field.modes.includes(mode))
  ));
}

export function getRuntimeSchemaEnumDefault(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode,
  fieldId: string,
): string | undefined {
  const value = getActiveEnumField(inputSchema, mode, fieldId)?.default;
  return typeof value === 'string' && value.trim().length ? value.trim() : undefined;
}

export function getRuntimeDurationDefault(
  capability: EngineModeUiCaps | undefined,
  fallback: number,
): number {
  const value = capability?.duration?.default;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+(?:\.\d+)?s?$/iu.test(value)) {
    return Number(value.replace(/s$/iu, ''));
  }
  return fallback;
}

export function deriveRuntimeSchemaCaps(
  inputSchema: EngineInputSchema | null | undefined,
  mode: Mode,
): EngineModeUiCaps | undefined {
  if (!inputSchema) return undefined;
  const fields = [...(inputSchema.required ?? []), ...(inputSchema.optional ?? [])];
  const durationField = getActiveEnumField(inputSchema, mode, 'duration');
  const resolutionField = getActiveEnumField(inputSchema, mode, 'resolution');
  const aspectRatioField = getActiveEnumField(inputSchema, mode, 'aspect_ratio');
  const durationDefault = durationField?.default;
  return {
    modes: [mode],
    ...(durationField?.values?.length
      ? {
          duration: {
            options: [...durationField.values],
            ...(typeof durationDefault === 'string' || typeof durationDefault === 'number'
              ? { default: durationDefault }
              : {}),
          },
        }
      : {}),
    ...(resolutionField?.values?.length ? { resolution: [...resolutionField.values] } : {}),
    ...(aspectRatioField?.values?.length ? { aspectRatio: [...aspectRatioField.values] } : {}),
    audioToggle: fields.some((field) => (
      field.type === 'boolean'
      && (field.id === 'audio' || field.id === 'generate_audio')
      && (!field.modes?.length || field.modes.includes(mode))
    )),
  };
}
