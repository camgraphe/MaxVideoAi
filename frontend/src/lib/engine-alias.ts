import { listFalEngines } from '@/config/falEngines';
import { resolveRuntimeEngineInput } from '../../config/model-runtime';

const PROVIDER_INPUT_ALIASES = new Map<string, string>();

for (const entry of listFalEngines()) {
  for (const value of [entry.defaultFalModelId, ...entry.modes.map((mode) => mode.falModelId)]) {
    PROVIDER_INPUT_ALIASES.set(value.trim().toLowerCase(), entry.id);
  }
}

export function normalizeEngineId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return resolveRuntimeEngineInput(key)?.id ?? PROVIDER_INPUT_ALIASES.get(key) ?? raw;
}
