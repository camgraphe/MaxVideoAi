/** Descriptive canonical receipt timing only; never recompute it from requested settings. */
export function recordedGenerationOutputDuration(
  snapshot: unknown,
): number | undefined {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot))
    return undefined;
  const canonical = (snapshot as Record<string, unknown>).canonicalPricing;
  if (!canonical || typeof canonical !== "object" || Array.isArray(canonical))
    return undefined;
  const meta = (canonical as Record<string, unknown>).meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta))
    return undefined;
  const value = (meta as Record<string, unknown>).output_duration_sec;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}
