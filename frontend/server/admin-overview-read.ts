export type OverviewUser = { id: string; email: string | null; createdAt: string };
type AuthUser = { id: string; email?: string | null; created_at: string };

// Each source has its own deadline; one unavailable source never erases the other.
async function boundedRead<T>(read: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(() => read(controller.signal)),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(null);
        }, timeoutMs);
      }),
    ]).catch(() => null);
  } finally {
    clearTimeout(timer);
  }
}

export async function readOverviewSources<TUsers, TFinance>(
  sources: {
    users: (signal: AbortSignal) => Promise<TUsers>;
    finance: (signal: AbortSignal) => Promise<TFinance>;
  },
  timeoutMs = 5000
) {
  const [users, finance] = await Promise.all([
    boundedRead(sources.users, timeoutMs),
    boundedRead(sources.finance, timeoutMs),
  ]);
  return { users, finance };
}

export async function scanRegistrations(
  from: string,
  to: string,
  signal: AbortSignal,
  listUsers: (page: number) => Promise<AuthUser[]>,
  excludedUserIds: ReadonlySet<string> = new Set()
) {
  let count = 0;
  let recent: OverviewUser[] = [];
  // Never publish a partial total if the account or time budget is exhausted.
  for (let page = 1; page <= 100; page++) {
    signal.throwIfAborted();
    const users = await listUsers(page);
    // Auth SDK has no per-call abort option. Stop subsequent pages after a late response.
    signal.throwIfAborted();
    for (const user of users) {
      if (excludedUserIds.has(user.id)) continue;
      const createdAt = new Date(user.created_at).toISOString();
      if (createdAt < from || createdAt >= to) continue;
      count++;
      recent.push({ id: user.id, email: user.email ?? null, createdAt });
    }
    recent = recent.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 12);
    if (users.length < 1000) return { count, recent };
  }
  throw new Error('Registration scan limit reached');
}
