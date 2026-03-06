const DEFAULT_PLATFORM_MARGIN_PERCENT = 0.3;

export function applyDisplayedPriceMarginCents(
  baseCents: number,
  marginPercent = DEFAULT_PLATFORM_MARGIN_PERCENT
): number {
  const normalizedBase = Math.max(0, Math.round(baseCents));
  if (!normalizedBase) return 0;
  const normalizedMargin = Number.isFinite(marginPercent) ? Math.max(0, marginPercent) : 0;
  return normalizedBase + Math.round(normalizedBase * normalizedMargin);
}
