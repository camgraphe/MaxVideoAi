import type { ModelSpec, RangeOption } from "@/data/models";

function pickFallback(range?: RangeOption, fallback?: number): number | undefined {
  if (typeof fallback === "number" && Number.isFinite(fallback)) {
    return fallback;
  }
  if (range?.default !== undefined) {
    return range.default;
  }
  if (range?.min !== undefined) {
    return range.min;
  }
  return undefined;
}

export function normalizeNumber(
  value: unknown,
  range?: RangeOption,
  fallback?: number,
): number | undefined {
  if (!range) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    return pickFallback(undefined, fallback);
  }

  const base =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : pickFallback(range, fallback) ?? range.min;

  const clamped = Math.min(range.max, Math.max(range.min, base));
  const step = range.step && Number.isFinite(range.step) && range.step > 0 ? range.step : undefined;
  if (!step) {
    return Number(clamped.toFixed(5));
  }
  const steps = Math.round((clamped - range.min) / step);
  const snapped = range.min + steps * step;
  return Number(snapped.toFixed(5));
}

export function normalizeDurationSeconds(value: unknown, spec: ModelSpec): number {
  const constraints = spec.constraints.durationSeconds;
  if (!constraints) {
    const base = typeof value === "number" && Number.isFinite(value) ? value : 1;
    return Math.max(1, Math.round(base));
  }

  const base =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : constraints.default ?? constraints.min;

  const clamped = Math.min(constraints.max, Math.max(constraints.min, base));
  const step = constraints.step && constraints.step > 0 ? constraints.step : 1;
  const steps = Math.round((clamped - constraints.min) / step);
  const snapped = constraints.min + steps * step;
  return Number(snapped.toFixed(5));
}

export function isValidUrl(candidate: unknown): candidate is string {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return false;
  }
  try {
    new URL(candidate);
    return true;
  } catch {
    return false;
  }
}
