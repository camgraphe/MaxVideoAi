export function normalizeVideoDurationOption(value: unknown): number | string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/\d/u.test(trimmed)) return trimmed;
  const numeric = Number(trimmed.replace(/[^\d.]/gu, ''));
  return Number.isFinite(numeric) ? Math.round(numeric) : trimmed;
}
