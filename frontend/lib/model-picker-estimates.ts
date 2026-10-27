/** Indicative estimates only. Generation keeps its fresh canonical quote. */
export type ModelEstimate = { amount: number; currency: string };
export type EstimateLease = { promise: Promise<ModelEstimate>; release: () => void };

export function modelEstimateKey(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
    return Object.fromEntries(Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)));
  });
}

type Pending = {
  key: string;
  revision: number;
  started: boolean;
  consumers: number;
  load: () => Promise<ModelEstimate>;
  promise: Promise<ModelEstimate>;
  resolve: (quote: ModelEstimate) => void;
  reject: (error: unknown) => void;
};

export function createModelEstimateQueue({ concurrency = 3, ttlMs = 60_000, maxEntries = 48, now = Date.now } = {}) {
  const cache = new Map<string, { quote: ModelEstimate; at: number }>();
  const pending = new Map<string, Pending>();
  const waiting: Pending[] = [];
  let revision = 0, active = 0, started = 0, peakActive = 0, hits = 0, shared = 0, dropped = 0;
  const abort = () => Object.assign(new Error('Estimate no longer requested'), { name: 'AbortError' });
  function drain() {
    while (active < concurrency && waiting.length) {
      const item = waiting.shift()!;
      if (!item.consumers || item.revision !== revision) continue;
      item.started = true;
      active++; started++; peakActive = Math.max(peakActive, active);
      const finish = () => {
        if (pending.get(item.key) === item) pending.delete(item.key);
        active--;
        drain();
      };
      Promise.resolve().then(item.load).then(quote => {
        if (!Number.isFinite(quote.amount) || quote.amount < 0 || !quote.currency) throw new Error('Invalid estimate');
        if (item.revision === revision) {
          if (cache.size >= maxEntries) cache.delete(cache.keys().next().value!);
          cache.set(item.key, { quote, at: now() });
        }
        finish();
        item.resolve(quote);
      }).catch(error => { finish(); item.reject(error); });
    }
  }
  function acquire(key: string, load: () => Promise<ModelEstimate>): EstimateLease {
    const cached = cache.get(key);
    if (cached && now() - cached.at < ttlMs) {
      hits++;
      return { promise: Promise.resolve(cached.quote), release() {} };
    }
    cache.delete(key);
    let item = pending.get(key);
    if (item) shared++;
    else {
      let resolve!: Pending['resolve'], reject!: Pending['reject'];
      const promise = new Promise<ModelEstimate>((done, fail) => { resolve = done; reject = fail; });
      item = { key, revision, started: false, consumers: 0, load, promise, resolve, reject };
      pending.set(key, item);
      waiting.push(item);
    }
    item.consumers++;
    drain();
    const acquired = item;
    let released = false;
    return { promise: acquired.promise, release() {
      if (released) return;
      released = true;
      acquired.consumers--;
      if (!acquired.started && !acquired.consumers) {
        const index = waiting.indexOf(acquired);
        if (index >= 0) waiting.splice(index, 1);
        if (pending.get(key) === acquired) pending.delete(key);
        dropped++;
        acquired.reject(abort());
      }
      // Running work is allowed to settle into the short cache. Reopening shares it.
    } };
  }
  return {
    acquire,
    // A render can reuse a fresh quote without scheduling work or extending its lifetime.
    peek(key: string) {
      const cached = cache.get(key);
      return cached && now() - cached.at < ttlMs ? cached.quote : undefined;
    },
    clear() {
      revision++;
      cache.clear();
      pending.clear();
      for (const item of waiting.splice(0)) { dropped++; item.reject(abort()); }
      // Late running responses cannot populate the new revision's cache.
    },
    stats: () => ({ active, peakActive, started, hits, shared, dropped, cached: cache.size, queued: waiting.length }),
  };
}

export type ModelEstimateQueue = ReturnType<typeof createModelEstimateQueue>;
