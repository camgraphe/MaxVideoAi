type Item = { key: string | number };

/** Keep a small recent window mounted. This stores keys, never bytes or read grants. */
export class RecentMediaItems<T extends Item> {
  private recent = new Map<T['key'], number>();
  constructor(private limit = 96, private lifetimeMs = 120_000) {}

  include(visible: T[], resolve: (key: T['key']) => T | null, now = Date.now()): T[] {
    const current = new Set(visible.map(item => item.key));
    for (const [key, seenAt] of this.recent) {
      if (now - seenAt > this.lifetimeMs || !resolve(key)) this.recent.delete(key);
    }
    for (const item of visible) {
      this.recent.delete(item.key);
      this.recent.set(item.key, now);
    }
    for (const key of this.recent.keys()) {
      if (this.recent.size <= Math.max(this.limit, current.size)) break;
      if (!current.has(key)) this.recent.delete(key);
    }
    const retained = [...visible];
    for (const key of this.recent.keys()) {
      if (!current.has(key)) {
        const item = resolve(key);
        if (item) retained.push(item);
      }
    }
    return retained;
  }
}
