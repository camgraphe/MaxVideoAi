const GA4_SESSION_ID_PATTERN = /^\d{1,20}$/;

export function normalizeGa4SessionId(value: unknown): string | null {
  const candidate =
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  if (!GA4_SESSION_ID_PATTERN.test(candidate)) return null;

  try {
    const normalized = BigInt(candidate);
    return normalized > BigInt(0) ? normalized.toString() : null;
  } catch {
    return null;
  }
}
