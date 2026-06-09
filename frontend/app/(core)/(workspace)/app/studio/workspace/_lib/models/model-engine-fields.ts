import type { EngineCaps, EngineInputField, Mode } from '@/types/engines';

export function fieldsFor(engine: EngineCaps): EngineInputField[] {
  return [...(engine.inputSchema?.required ?? []), ...(engine.inputSchema?.optional ?? [])];
}

export function hasFieldType(engine: EngineCaps, type: EngineInputField['type']): boolean {
  return fieldsFor(engine).some((field) => field.type === type);
}

export function hasFieldId(engine: EngineCaps, fragments: string[]): boolean {
  return fieldsFor(engine).some((field) => {
    const id = field.id.toLowerCase();
    return fragments.some((fragment) => id.includes(fragment));
  });
}

export function fieldSearchKey(field: EngineInputField): string {
  return [field.id, field.engineParam, field.label]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function hasMode(engine: EngineCaps, modes: Mode[]): boolean {
  return modes.some((mode) => engine.modes.includes(mode));
}
