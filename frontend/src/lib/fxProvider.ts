const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

type CacheEntry = {
  rates: Record<string, number>;
  asOf: string;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry>();

function normalizeSymbols(symbols: string[]): string[] {
  const unique = new Set<string>();
  symbols.forEach((symbol) => {
    const upper = symbol?.trim().toUpperCase();
    if (upper && upper !== 'USD') unique.add(upper);
  });
  return Array.from(unique).sort();
}

export async function fetchUsdRatesFrankfurter(symbols: string[]): Promise<{
  rates: Record<string, number>;
  asOf: string;
}> {
  const normalized = normalizeSymbols(symbols);
  const cacheKey = normalized.join(',');
  const now = Date.now();

  if (cacheKey.length) {
    const cached = cache.get(cacheKey);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      return { rates: { ...cached.rates }, asOf: cached.asOf };
    }
  }

  if (!normalized.length) {
    return { rates: {}, asOf: new Date().toISOString().slice(0, 10) };
  }

  const url = `https://api.frankfurter.app/latest?from=USD&to=${normalized.join(',')}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`frankfurter_fetch_failed:${res.status}`);
  }
  const json = (await res.json()) as { rates?: Record<string, number>; date?: string };
  const rates = json?.rates ?? {};
  const asOf = json?.date ?? new Date().toISOString().slice(0, 10);

  cache.set(cacheKey, { rates, asOf, fetchedAt: now });
  return { rates: { ...rates }, asOf };
}
