/** Provider validation bodies can echo signed inputs, including Error.cause/stack. */
export function sanitizeProviderMediaDiagnostics(value: unknown, canonicalByGrant: ReadonlyMap<string, string> = new Map()): unknown {
  const text = (source: string): string => {
    let result = source;
    for (const [grant, canonical] of canonicalByGrant) {
      result = result.split(grant).join(canonical)
        .split(encodeURIComponent(grant)).join(encodeURIComponent(canonical));
    }
    const sanitizeUrl = (candidate: string): string => {
      try {
        let decoded = candidate;
        let encodingDepth = 0;
        while (!/^https?:\/\//i.test(decoded) && encodingDepth < 3) {
          decoded = decodeURIComponent(decoded);
          encodingDepth++;
        }
        const url = new URL(decoded);
        if ([...url.searchParams.keys()].some(key => /^x-amz-/i.test(key))) {
          let canonical = `${url.origin}${url.pathname}`;
          for (let depth = 0; depth < encodingDepth; depth++) canonical = encodeURIComponent(canonical);
          return canonical;
        }
      } catch { /* Preserve ordinary diagnostic text. */ }
      return candidate;
    };
    return result
      .replace(/https?:\/\/[^\s"'<>]+/gi, sanitizeUrl)
      .replace(/https?%(?:25){0,2}3a%(?:25){0,2}2f%(?:25){0,2}2f(?:%[a-f0-9]{2}|[a-z0-9_.!~*()-])+/gi, sanitizeUrl);
  };
  const visited = new WeakMap<object, unknown>();
  const visit = (current: unknown): unknown => {
    if (typeof current === 'string') return text(current);
    if (!current || typeof current !== 'object') return current;
    if (visited.has(current)) return visited.get(current);
    if (Array.isArray(current)) {
      const array: unknown[] = [];
      visited.set(current, array);
      current.forEach(item => array.push(visit(item)));
      return array;
    }
    const record: Record<string, unknown> = {};
    visited.set(current, record);
    for (const key of Object.getOwnPropertyNames(current)) {
      if (/^x-amz-/i.test(key)) continue;
      record[key] = visit((current as Record<string, unknown>)[key]);
    }
    return record;
  };
  return visit(value);
}
