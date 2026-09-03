import type { EngineCaps, EngineModeUiCaps, Mode } from '@/types/engines';

function schemaSupportsField(
  inputSchema: EngineCaps['inputSchema'] | null | undefined,
  fieldId: string,
  mode: Mode,
): boolean {
  if (!inputSchema) return false;
  const fields = [...(inputSchema.required ?? []), ...(inputSchema.optional ?? [])];
  return fields.some((field) => {
    if (field.id !== fieldId) return false;
    if (!field.modes && !field.requiredInModes) return true;
    return Boolean(field.modes?.includes(mode) || field.requiredInModes?.includes(mode));
  });
}

export function workspaceModeSupportsRequestField(input: {
  inputSchema: EngineCaps['inputSchema'] | null | undefined;
  capability: EngineModeUiCaps | null | undefined;
  fieldId: 'aspect_ratio' | 'resolution';
  mode: Mode;
}): boolean {
  if (input.inputSchema) {
    return schemaSupportsField(input.inputSchema, input.fieldId, input.mode);
  }

  if (!input.capability) return true;
  return input.fieldId === 'aspect_ratio'
    ? (input.capability.aspectRatio?.length ?? 0) > 0
    : (input.capability.resolution?.length ?? 0) > 0;
}
