import type { AdminJobAuditRecord, RawJobAuditRow } from './types';

export function coerceNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function normalizeCurrency(value: string | null | undefined): string {
  return (value ?? 'USD').toUpperCase();
}

export function normalizeReceipts(
  raw: RawJobAuditRow['receipts']
): AdminJobAuditRecord['receipts'] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => ({
    id: entry.id,
    type: entry.type as AdminJobAuditRecord['receipts'][number]['type'],
    amountCents: entry.amountCents,
    currency: normalizeCurrency(entry.currency),
    createdAt: entry.createdAt,
  }));
}

export function normalizeAuditText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (!trimmed.length) return null;
    if (/^(error|failed|null|undefined|n\/a)$/i.test(trimmed)) return null;
    return trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function findFirstTextByKeys(payload: unknown, keys: string[]): string | null {
  if (!payload) return null;
  const normalizedKeys = new Set(keys.map((key) => key.toLowerCase()));
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    const direct = normalizeAuditText(current);
    if (direct && typeof current !== 'object') {
      return direct;
    }

    if (Array.isArray(current)) {
      current.forEach((entry) => stack.push(entry));
      continue;
    }

    const record = asRecord(current);
    if (!record) continue;

    for (const [key, value] of Object.entries(record)) {
      if (normalizedKeys.has(key.toLowerCase())) {
        const candidate = normalizeAuditText(value);
        if (candidate) return candidate;
      }
    }

    for (const value of Object.values(record)) {
      if (value && (typeof value === 'object' || Array.isArray(value))) {
        stack.push(value);
      }
    }
  }

  return null;
}
