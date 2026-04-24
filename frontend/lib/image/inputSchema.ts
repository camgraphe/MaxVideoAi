import type { EngineCaps, EngineInputField } from '@/types/engines';
import type { ImageGenerationMode } from '@/types/image-generation';

const FALLBACK_RESOLUTION = 'square_hd';
const DEFAULT_IMAGE_COUNT_MIN = 1;
const DEFAULT_IMAGE_COUNT_MAX = 8;
const DEFAULT_REFERENCE_LIMIT = 4;
export const MAX_REFERENCE_IMAGES = 14;

export type ResolvedEnumValue =
  | { ok: true; value: string; allowed: string[]; configurable: boolean }
  | { ok: false; allowed: string[] };

export function getImageInputFields(engine: EngineCaps | null | undefined): EngineInputField[] {
  if (!engine?.inputSchema) {
    return [];
  }
  return [...(engine.inputSchema.required ?? []), ...(engine.inputSchema.optional ?? [])];
}

export function getImageInputField(
  engine: EngineCaps | null | undefined,
  fieldId: string,
  mode: ImageGenerationMode
): EngineInputField | null {
  const fields = getImageInputFields(engine);
  if (!fields.length) return null;
  const prioritized =
    fields.find(
      (field) =>
        field.id === fieldId &&
        (field.modes?.includes(mode) || field.requiredInModes?.includes(mode))
    ) ?? null;
  if (prioritized) return prioritized;
  return (
    fields.find(
      (field) =>
        field.id === fieldId &&
        (!Array.isArray(field.modes) || field.modes.length === 0) &&
        (!Array.isArray(field.requiredInModes) || field.requiredInModes.length === 0)
    ) ?? null
  );
}

export function canonicalizeImageFieldValue(values: string[], candidate: string | null | undefined): string | null {
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

function sanitizeStringValues(values: unknown[]): string[] {
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length);
}

export function normalizeFalImageResolution(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (/^\d+(?:\.\d+)?k$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export function getImageFieldValues(
  engine: EngineCaps | null | undefined,
  fieldId: string,
  mode: ImageGenerationMode,
  fallbackValues: string[] = []
): string[] {
  const field = getImageInputField(engine, fieldId, mode);
  const values = Array.isArray(field?.values) && field.values.length ? field.values : fallbackValues;
  return sanitizeStringValues(values);
}

export function getImageFieldDefaultString(
  engine: EngineCaps | null | undefined,
  fieldId: string,
  mode: ImageGenerationMode
): string | null {
  const field = getImageInputField(engine, fieldId, mode);
  return typeof field?.default === 'string' && field.default.trim().length ? field.default.trim() : null;
}

export function getImageFieldDefaultBoolean(
  engine: EngineCaps | null | undefined,
  fieldId: string,
  mode: ImageGenerationMode
): boolean | null {
  const field = getImageInputField(engine, fieldId, mode);
  return typeof field?.default === 'boolean' ? field.default : null;
}

export function getImageFieldDefaultNumber(
  engine: EngineCaps | null | undefined,
  fieldId: string,
  mode: ImageGenerationMode
): number | null {
  const field = getImageInputField(engine, fieldId, mode);
  return typeof field?.default === 'number' && Number.isFinite(field.default) ? field.default : null;
}

function resolveEnumValue(
  values: string[],
  requested: string | null | undefined,
  fallback: string | null,
  configurable: boolean
): ResolvedEnumValue {
  if (requested) {
    const match = canonicalizeImageFieldValue(values, requested);
    if (values.length && !match) {
      return { ok: false, allowed: values };
    }
    if (match) {
      return { ok: true, value: match, allowed: values, configurable };
    }
  }

  return {
    ok: true,
    value: fallback ?? values[0] ?? '',
    allowed: values,
    configurable,
  };
}

export function getAspectRatioOptions(
  engine: EngineCaps | null | undefined,
  mode: ImageGenerationMode
): string[] {
  const field = getImageInputField(engine, 'aspect_ratio', mode);
  const fallback = Array.isArray(engine?.aspectRatios) ? engine.aspectRatios : [];
  const sourceValues =
    Array.isArray(field?.values) && field.values.length ? field.values : fallback;
  return sanitizeStringValues(sourceValues);
}

export function getDefaultAspectRatio(
  engine: EngineCaps | null | undefined,
  mode: ImageGenerationMode
): string | null {
  const options = getAspectRatioOptions(engine, mode);
  const explicitDefault = getImageFieldDefaultString(engine, 'aspect_ratio', mode);
  return canonicalizeImageFieldValue(options, explicitDefault) ?? options[0] ?? null;
}

export function resolveRequestedAspectRatio(
  engine: EngineCaps | null | undefined,
  mode: ImageGenerationMode,
  requested?: string | null
): ResolvedEnumValue {
  const field = getImageInputField(engine, 'aspect_ratio', mode);
  const allowed = getAspectRatioOptions(engine, mode);
  const fallback = getDefaultAspectRatio(engine, mode);
  return resolveEnumValue(allowed, requested, fallback, Boolean(field));
}

export function getResolutionOptions(
  engine: EngineCaps | null | undefined,
  mode: ImageGenerationMode
): string[] {
  const field = getImageInputField(engine, 'resolution', mode);
  const fallback = Array.isArray(engine?.resolutions) ? engine.resolutions : [];
  const sourceValues =
    Array.isArray(field?.values) && field.values.length ? field.values : fallback;
  return sanitizeStringValues(sourceValues);
}

export function getDefaultResolution(
  engine: EngineCaps | null | undefined,
  mode: ImageGenerationMode
): string {
  const options = getResolutionOptions(engine, mode);
  const explicitDefault = getImageFieldDefaultString(engine, 'resolution', mode);
  return (
    canonicalizeImageFieldValue(options, explicitDefault) ??
    options[0] ??
    engine?.resolutions?.[0] ??
    FALLBACK_RESOLUTION
  );
}

export function resolveRequestedResolution(
  engine: EngineCaps,
  mode: ImageGenerationMode,
  requested?: string | null
):
  | { ok: true; resolution: string; configurable: boolean }
  | { ok: false; code: 'resolution_invalid'; allowed: string[] } {
  const field = getImageInputField(engine, 'resolution', mode);
  const allowedValues = getResolutionOptions(engine, mode);
  const resolved = resolveEnumValue(
    allowedValues,
    requested,
    getDefaultResolution(engine, mode),
    Boolean(field)
  );
  if (!resolved.ok) {
    return { ok: false, code: 'resolution_invalid', allowed: resolved.allowed };
  }
  return {
    ok: true,
    resolution: resolved.value,
    configurable: resolved.configurable,
  };
}

function parseCount(value: number | undefined | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  const rounded = Math.round(value);
  return rounded >= 0 ? rounded : null;
}

export function getImageCountConstraints(
  engine: EngineCaps | null | undefined,
  mode: ImageGenerationMode
): {
  min: number;
  max: number;
  defaultValue: number;
} {
  const field = getImageInputField(engine, 'num_images', mode);
  const min = Math.max(DEFAULT_IMAGE_COUNT_MIN, parseCount(field?.min) ?? DEFAULT_IMAGE_COUNT_MIN);
  const rawMax = parseCount(field?.max) ?? DEFAULT_IMAGE_COUNT_MAX;
  const max = Math.max(min, rawMax);
  const rawDefault =
    typeof field?.default === 'number' && Number.isFinite(field.default)
      ? Math.round(field.default)
      : DEFAULT_IMAGE_COUNT_MIN;
  const defaultValue = Math.min(max, Math.max(min, rawDefault));
  return { min, max, defaultValue };
}

export function clampRequestedImageCount(
  engine: EngineCaps | null | undefined,
  mode: ImageGenerationMode,
  requested: number | null | undefined
): number {
  const constraints = getImageCountConstraints(engine, mode);
  const candidate = typeof requested === 'number' && Number.isFinite(requested) ? Math.round(requested) : constraints.defaultValue;
  return Math.min(constraints.max, Math.max(constraints.min, candidate));
}

export function getReferenceConstraints(engine: EngineCaps, mode: ImageGenerationMode): {
  min: number;
  max: number;
  requires: boolean;
} {
  const field = getImageInputField(engine, 'image_urls', mode);
  const requires = mode === 'i2i' || Boolean(field?.requiredInModes?.includes(mode));
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
