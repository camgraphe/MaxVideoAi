export function extractStringField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length) return trimmed;
    }
  }
  return null;
}

export function findFirstString(payload: unknown, keys: string[]): string | null {
  const visited = new Set<unknown>();
  const stack: unknown[] = [payload];

  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    if (visited.has(current)) continue;
    visited.add(current);

    const record = current as Record<string, unknown>;
    const candidate = extractStringField(record, keys);
    if (candidate) return candidate;

    const metadata = record.metadata;
    if (metadata && typeof metadata === 'object') {
      stack.push(metadata);
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return null;
}
