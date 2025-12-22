export type PricingRuleLite = {
  id?: string;
  engineId?: string | null;
  resolution?: string | null;
  marginPercent?: number | null;
  marginFlatCents?: number | null;
  currency?: string | null;
};

function normalizeKey(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

export function selectPricingRule(
  rules: PricingRuleLite[] | undefined,
  engineId: string,
  resolution?: string | null
): PricingRuleLite | null {
  if (!rules || rules.length === 0) return null;
  const normalizedEngine = normalizeKey(engineId);
  const normalizedResolution = normalizeKey(resolution);

  const exact = rules.find(
    (rule) =>
      normalizeKey(rule.engineId) === normalizedEngine &&
      normalizeKey(rule.resolution) === normalizedResolution
  );
  if (exact) return exact;

  const engineOnly = rules.find(
    (rule) =>
      normalizeKey(rule.engineId) === normalizedEngine && normalizeKey(rule.resolution) === ''
  );
  if (engineOnly) return engineOnly;

  const fallback = rules.find(
    (rule) => normalizeKey(rule.engineId) === '' && normalizeKey(rule.resolution) === ''
  );
  return fallback ?? null;
}
