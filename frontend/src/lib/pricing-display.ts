const DEFAULT_PLATFORM_MARGIN_PERCENT = 0.3;
const CENT_EPSILON = 1e-9;

export function applyDisplayedPriceMarginCents(
  baseCents: number,
  marginPercent = DEFAULT_PLATFORM_MARGIN_PERCENT
): number {
  const normalizedBase = Math.max(0, Math.round(baseCents));
  if (!normalizedBase) return 0;
  const normalizedMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  const total = Math.ceil(normalizedBase * (1 + normalizedMargin) - CENT_EPSILON);
  if (normalizedMargin > 0 && total <= normalizedBase) {
    return normalizedBase + 1;
  }
  return total;
}
