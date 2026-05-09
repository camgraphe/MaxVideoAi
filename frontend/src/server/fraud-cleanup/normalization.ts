export function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').trim().toUpperCase() || 'USD';
}

export function normalizeIdList(values: string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))
  );
}
