import { resolveSeedanceEditSourceFacts, type SeedanceEditSourceFacts } from './seedance-edit-source';
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

/** Bounded recorded source facts for inherited Edit output; no provider or private fields. */
export function recordedGenerationSourceVideoOutput(snapshot: unknown): SeedanceEditSourceFacts | undefined {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return undefined;
  const canonical = (snapshot as Record<string, unknown>).canonicalPricing;
  if (!canonical || typeof canonical !== 'object' || Array.isArray(canonical)) return undefined;
  const meta = (canonical as Record<string, unknown>).meta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  const source = (meta as Record<string, unknown>).seedanceEditSource;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const stored = source as Record<string, unknown>;
  try {
    const facts = resolveSeedanceEditSourceFacts({ durationSec: stored.durationSec as number, width: stored.width as number, height: stored.height as number });
    return stored.outputDuration === 'source' && stored.outputAspectRatio === 'source'
      && stored.billedDurationSec === facts.billedDurationSec && stored.pricingAspectRatio === facts.pricingAspectRatio
      ? facts : undefined;
  } catch { return undefined; }
}
