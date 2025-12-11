import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';

const FALLBACK_RESOLUTION = 'square_hd';
export const MAX_REFERENCE_IMAGES = 8;
export const DEFAULT_REFERENCE_LIMIT = 4;

function getInputFields(engine: EngineCaps | null | undefined): EngineInputField[] {
  if (!engine?.inputSchema) {
    return [];
  }
  return [...(engine.inputSchema.required ?? []), ...(engine.inputSchema.optional ?? [])];
}

function findField(
  engine: EngineCaps | null | undefined,
  fieldId: string,
  mode: ImageGenerationMode
): EngineInputField | null {
  const fields = getInputFields(engine);
  if (!fields.length) return null;
  const prioritized =
    fields.find(
      (field) =>
        field.id === fieldId &&
        (field.modes?.includes(mode) || field.requiredInModes?.includes(mode))
    ) ?? null;
  if (prioritized) return prioritized;
  return fields.find((field) => field.id === fieldId) ?? null;
}

function canonicalizeValue(values: string[], candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  const normalized = candidate.trim().toLowerCase();
  if (!normalized) return null;
  for (const value of values) {
    if (value.toLowerCase() === normalized) {
      return value;
    }
  }
  return null;
}

function normalizeAllowedResolutions(engine: EngineCaps, field: EngineInputField | null): string[] {
  const sourceValues =
    (Array.isArray(field?.values) && field?.values.length ? field.values : engine.resolutions) ?? [];
  return sourceValues
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length);
}

export function resolveRequestedResolution(
  engine: EngineCaps,
  mode: ImageGenerationMode,
  requested?: string | null
):
  | { ok: true; resolution: string; configurable: boolean }
  | { ok: false; code: 'resolution_invalid'; allowed: string[] } {
  const field = findField(engine, 'resolution', mode);
  const allowedValues = normalizeAllowedResolutions(engine, field);
  const configurable = Boolean(field);
  const fallback =
    canonicalizeValue(allowedValues, typeof field?.default === 'string' ? field.default : null) ??
    allowedValues[0] ??
    engine.resolutions[0] ??
    FALLBACK_RESOLUTION;

  if (requested) {
    const match = canonicalizeValue(allowedValues, requested);
    if (allowedValues.length && !match) {
      return {
        ok: false,
        code: 'resolution_invalid',
        allowed: allowedValues,
      } as const;
    }
    if (match) {
      return { ok: true, resolution: match, configurable } as const;
    }
  }

  return { ok: true, resolution: fallback, configurable } as const;
}

function parseCount(value: number | undefined | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded >= 0 ? rounded : null;
}

export function getReferenceConstraints(engine: EngineCaps, mode: ImageGenerationMode): {
  min: number;
  max: number;
  requires: boolean;
} {
  const field = findField(engine, 'image_urls', mode);
  const requires =
    mode === 'i2i' || Boolean(field?.requiredInModes?.includes(mode));
  const minCount = requires ? Math.max(1, parseCount(field?.minCount) ?? 1) : 0;
  const rawMax = parseCount(field?.maxCount) ?? DEFAULT_REFERENCE_LIMIT;
  const sanitizedMax = Math.min(MAX_REFERENCE_IMAGES, Math.max(1, rawMax));
  const maxCount = Math.max(minCount || 1, sanitizedMax);
  return {
    min: minCount,
    max: maxCount,
    requires,
  };
}
